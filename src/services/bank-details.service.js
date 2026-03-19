import { bankDetailsRepository } from "../repositories/bank-details.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";

// Bank Details Service — business logic for bank details review workflow.
class BankDetailsService {

    // Get bank details with filters and pagination.
    async getPendingBankDetails({ count = 0, limit = 50, search = null, status = null }) {
        const { bankDetails, total } = await bankDetailsRepository.getBankDetailsWithUserInfo({
            status, search, offset: count, limit,
        });

        const formattedBankDetails = Array.isArray(bankDetails) ? bankDetails.map(detail => ({
            id: detail.id,
            user_id: detail.user_id,
            investor_name: `${detail.f_name} ${detail.l_name}`,
            investor_email: detail.email,
            initial_capital: parseFloat(detail.initial_capital),
            current_portfolio: parseFloat(detail.current_portfolio),
            account_holder_name: detail.account_holder_name,
            account_number: detail.account_number,
            bank_name: detail.bank_name,
            swift_code: detail.swift_code,
            bsb_number: detail.bsb_number,
            beneficiary_address: detail.beneficiary_address,
            iban: detail.iban,
            status: detail.status,
            reject_reason: detail.reject_reason,
            created_at: detail.created_at,
            updated_at: detail.updated_at,
        })) : [];

        return { bank_details: formattedBankDetails, total };
    }

    // Review (approve/reject) bank details.
    async reviewBankDetails(adminId, { bank_details_id, action, reject_reason }) {

        // Normalize action to status value
        let statusValue;
        if (action === "approve") {
            statusValue = 1;
        } else if (action === "reject") {
            statusValue = 2;
            if (!reject_reason) {
                throw ApiError.badRequest("Reject reason is required when rejecting bank details");
            }
        } else {
            throw ApiError.badRequest("Invalid action. Must be 'approve' or 'reject'");
        }

        const bankDetail = await bankDetailsRepository.findByIdWithUser(bank_details_id);
        if (!bankDetail) {
            throw ApiError.notFound("Bank details not found");
        }

        if (bankDetail.status !== 0) {
            throw ApiError.badRequest("Bank details have already been reviewed");
        }

        const updated = await bankDetailsRepository.updateReviewStatus(bank_details_id, statusValue, reject_reason, adminId);
        if (!updated) {
            throw ApiError.internal("Failed to update bank details");
        }

        // If approved, update user flag
        if (statusValue === 1) {
            await bankDetailsRepository.setUserBankDetailsFlag(bankDetail.user_id);
        }

        // Send notification (non-blocking)
        const isApproved = statusValue === 1;
        try {
            await notificationService.sendNotification({
                user_ids: [bankDetail.user_id],
                title: isApproved ? "Bank Details Approved" : "Bank Details Rejected",
                message: isApproved
                    ? "Your bank details have been approved and are now active."
                    : `Your bank details were rejected. Reason: ${reject_reason}`,
                type: "bank_details_review",
                type_id: bank_details_id,
                payload: { bank_details_id, status: statusValue, reject_reason: reject_reason || null },
                email_template: isApproved ? "bank_details_approved" : "bank_details_rejected",
                email_data: {
                    name: `${bankDetail.f_name} ${bankDetail.l_name}`,
                    account_holder_name: bankDetail.account_holder_name,
                    bank_name: bankDetail.bank_name,
                    approved_at: new Date().toLocaleDateString(),
                    rejected_at: new Date().toLocaleDateString(),
                    reject_reason: reject_reason || "N/A",
                },
                send_push: true,
            });
        } catch (err) {
            console.error("Notification error:", err);
        }

        return {
            bank_details_id,
            user_id: bankDetail.user_id,
            status: statusValue,
            reviewed_by: adminId,
            action_label: isApproved ? "approved" : "rejected",
        };
    }
}

const bankDetailsService = new BankDetailsService();
export { bankDetailsService, BankDetailsService };
