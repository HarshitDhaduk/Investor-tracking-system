import { BaseRepository } from "../repositories/base.repository.js";

// Payment Scheduling Service encapsulates schedule generation and payment calculations
class PaymentSchedulingService extends BaseRepository {
    constructor() {
        super();
    }

    async generatePaymentSchedule(userId, investmentDate, contractEndDate, contractType, fixedRate, principalAmount) {
        try {
            // Validate investor exists
            const investor = await this.selectOne(
                "SELECT id, contract_type, fixed_interest_rate, investment_day FROM users WHERE id = ? AND role = 1",
                [userId]
            );

            if (!investor) {
                return false;
            }

            // Parse dates
            const startDate = new Date(investmentDate);
            const endDate = new Date(contractEndDate);
            const investmentDay = startDate.getDate();

            const scheduleRecords = [];
            let currentDate = new Date(startDate);
            currentDate.setMonth(currentDate.getMonth() + 1);

            while (currentDate <= endDate) {
                const targetDay = this.getValidDayForMonth(currentDate.getFullYear(), currentDate.getMonth(), investmentDay);
                currentDate.setDate(targetDay);

                let paymentAmount = 0;
                let paymentType = contractType;

                if (contractType === 0) {
                    paymentAmount = parseFloat((principalAmount * fixedRate).toFixed(6));
                } else {
                    if (currentDate.getTime() === endDate.getTime()) {
                        const monthsToMaturity = this.getMonthsDifference(startDate, endDate);
                        paymentAmount = parseFloat((principalAmount * Math.pow(1 + fixedRate, monthsToMaturity)).toFixed(6));
                    } else {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                        continue;
                    }
                }

                scheduleRecords.push({
                    user_id: userId,
                    due_date: currentDate.toISOString().split('T')[0],
                    payment_amount: paymentAmount,
                    payment_type: paymentType,
                    principal_amount: principalAmount,
                    status: 0
                });

                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            for (const record of scheduleRecords) {
                await this.insert(
                    `INSERT INTO payment_schedules 
                     (user_id, due_date, payment_amount, payment_type, principal_amount, status) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [record.user_id, record.due_date, record.payment_amount, record.payment_type, record.principal_amount, record.status]
                );
            }
            return true;

        } catch (error) {
            console.error("Error in generatePaymentSchedule:", error);
            return false;
        }
    }

    async getUpcomingPayments(filters = {}) {
        try {
            const { limit = 50, offset = 0, startDate = null, endDate = null, status = null, userId = null } = filters;
            let query = `
                SELECT 
                    ps.id, ps.user_id, ps.due_date, ps.payment_amount, ps.payment_type,
                    ps.principal_amount, ps.status, ps.paid_date, ps.notes, ps.created_at,
                    u.f_name, u.l_name, u.email, u.contract_type, u.fixed_interest_rate
                FROM payment_schedules ps
                JOIN users u ON ps.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (startDate) { query += " AND ps.due_date >= ?"; params.push(startDate); }
            if (endDate) { query += " AND ps.due_date <= ?"; params.push(endDate); }
            if (status !== null) { query += " AND ps.status = ?"; params.push(status); }
            if (userId) { query += " AND ps.user_id = ?"; params.push(userId); }

            query += " ORDER BY ps.due_date ASC, ps.created_at DESC LIMIT ? OFFSET ?";
            params.push(limit, offset);

            const results = await this.select(query, params);
            return results || [];
        } catch (error) {
            console.error("Error in getUpcomingPayments:", error);
            return [];
        }
    }

    async calculatePaymentAmount(userId, dueDate) {
        try {
            const investor = await this.selectOne(
                `SELECT id, contract_type, fixed_interest_rate, contract_start_date, contract_end_date, initial_capital FROM users WHERE id = ? AND role = 1`,
                [userId]
            );

            if (!investor) return null;

            const tranches = await this.select(
                "SELECT capital_amount, contract_start_date FROM capital_tranches WHERE user_id = ? AND status = 1 ORDER BY contract_start_date ASC",
                [userId]
            );

            let totalPrincipal = parseFloat(investor.initial_capital);

            if (tranches && tranches.length > 0) {
                if (investor.contract_type === 0) {
                    totalPrincipal = tranches.reduce((sum, tranche) => sum + parseFloat(tranche.capital_amount), 0);
                } else {
                    const dueDateObj = new Date(dueDate);
                    for (const tranche of tranches.slice(1)) {
                        const trancheDate = new Date(tranche.contract_start_date);
                        const monthsGrown = this.getMonthsDifference(trancheDate, dueDateObj);
                        const presentValue = parseFloat(tranche.capital_amount) * Math.pow(1 + parseFloat(investor.fixed_interest_rate) / 100, monthsGrown);
                        totalPrincipal += presentValue;
                    }
                }
            }

            let paymentAmount = 0;
            if (investor.contract_type === 0) {
                paymentAmount = totalPrincipal * (parseFloat(investor.fixed_interest_rate) / 100);
            } else {
                const contractEndDate = new Date(investor.contract_end_date);
                const dueDateObj = new Date(dueDate);
                if (dueDateObj.getTime() === contractEndDate.getTime()) {
                    const investmentDate = new Date(investor.contract_start_date);
                    const monthsToMaturity = this.getMonthsDifference(investmentDate, contractEndDate);
                    paymentAmount = totalPrincipal * Math.pow(1 + parseFloat(investor.fixed_interest_rate) / 100, monthsToMaturity);
                }
            }

            return {
                user_id: userId,
                due_date: dueDate,
                payment_amount: parseFloat(paymentAmount.toFixed(6)),
                payment_type: investor.contract_type,
                principal_amount: parseFloat(totalPrincipal.toFixed(6)),
                contract_type: investor.contract_type,
                fixed_rate: parseFloat(investor.fixed_interest_rate)
            };
        } catch (error) {
            console.error("Error in calculatePaymentAmount:", error);
            return null;
        }
    }

    getValidDayForMonth(year, month, day) {
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        return day <= lastDayOfMonth ? day : lastDayOfMonth;
    }

    getMonthsDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (end.getDate() < start.getDate()) months--;
        return months;
    }

    async markPaymentAsPaid(paymentId, paidDate, notes = null) {
        try {
            return await this.update(
                "UPDATE payment_schedules SET status = 1, paid_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [paidDate, notes, paymentId]
            );
        } catch (error) {
            console.error("Error in markPaymentAsPaid:", error);
            return false;
        }
    }

    async calculateFundAdjustmentForPayables(month, year) {
        try {
            const targetDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const nextMonth = new Date(year, month, 1).toISOString().split('T')[0];
            
            const monthlyPayments = await this.select(
                `SELECT ps.user_id, ps.payment_amount, ps.status, ps.due_date,
                        u.f_name, u.l_name, u.contract_type, u.fixed_interest_rate
                 FROM payment_schedules ps
                 JOIN users u ON ps.user_id = u.id
                 WHERE ps.due_date >= ? AND ps.due_date < ?
                   AND u.contract_type = 0 AND u.role = 1 AND u.status = 1`,
                [targetDate, nextMonth]
            );

            let totalMonthlyPayables = 0;
            const adjustmentDetails = [];
            const payableInvestorsCount = new Set();

            if (Array.isArray(monthlyPayments)) {
                for (const payment of monthlyPayments) {
                    const paymentAmount = parseFloat(payment.payment_amount) || 0;
                    totalMonthlyPayables += paymentAmount;
                    payableInvestorsCount.add(payment.user_id);
                    
                    adjustmentDetails.push({
                        user_id: payment.user_id,
                        investor_name: `${payment.f_name} ${payment.l_name}`,
                        payment_amount: paymentAmount,
                        payment_status: payment.status,
                        payment_status_text: payment.status === 0 ? 'Pending' : payment.status === 1 ? 'Paid' : 'Overdue',
                        due_date: payment.due_date,
                        fixed_interest_rate: parseFloat(payment.fixed_interest_rate) || 0
                    });
                }
            }

            return {
                total_monthly_payables: parseFloat(totalMonthlyPayables.toFixed(6)),
                payable_investors_count: payableInvestorsCount.size,
                adjustment_details: adjustmentDetails,
                calculation_month: month,
                calculation_year: year,
                data_source: 'payment_schedules'
            };
        } catch (error) {
            console.error('Error calculating fund adjustment for payables:', error);
            return { error: error.message };
        }
    }

    async getInvestorPaymentSchedule(userId, filters = {}) {
        try {
            const { limit = 50, offset = 0, status = null, startDate = null, endDate = null } = filters;
            let query = `SELECT id, due_date, payment_amount, payment_type, principal_amount, status, paid_date, notes, created_at FROM payment_schedules WHERE user_id = ?`;
            const params = [userId];

            if (status !== null) { query += " AND status = ?"; params.push(status); }
            if (startDate) { query += " AND due_date >= ?"; params.push(startDate); }
            if (endDate) { query += " AND due_date <= ?"; params.push(endDate); }

            query += " ORDER BY due_date ASC LIMIT ? OFFSET ?";
            params.push(limit, offset);

            const results = await this.select(query, params);
            return results || [];
        } catch (error) {
            console.error("Error in getInvestorPaymentSchedule:", error);
            return [];
        }
    }
}

const paymentSchedulingService = new PaymentSchedulingService();
export { paymentSchedulingService, PaymentSchedulingService };
