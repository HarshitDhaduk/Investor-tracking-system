import { CONFIG } from "../config/flavour.js";
import nodemailer from "nodemailer";
import path from "path";
import ejs from "ejs";
import fs from "fs";

const __dirname = path.resolve();

// Mail Service — handles sending emails using nodemailer and ejs templates.
class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: CONFIG.SMTP_HOST,
            port: CONFIG.SMTP_PORT,
            secure: CONFIG.SMTP_SECURE === "true" || CONFIG.SMTP_SECURE === true,
            auth: {
                user: CONFIG.SMTP_USER,
                pass: CONFIG.SMTP_PASS,
            },
        });
    }

    // Send an email using an EJS template.
    async sendMail({ to, subject, templateName, data }) {
        try {
            const templatePath = path.join(
                __dirname,
                "src",
                "views",
                "emails",
                `${templateName}.ejs`
            );

            if (!fs.existsSync(templatePath)) {
                console.error(`[MailService] Template not found: ${templatePath}`);
                return false;
            }

            const template = fs.readFileSync(templatePath, "utf-8");
            const html = ejs.render(template, data);

            const mailOptions = {
                from: {
                    name: CONFIG.SMTP_NAME || CONFIG.SMTP_FROM,
                    address: CONFIG.SMTP_FROM
                },
                to,
                subject,
                html,
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[MailService] Email sent to ${to} (Message ID: ${info.messageId})`);
            return true;
        } catch (error) {
            console.error("[MailService] Error sending email:", error.message);
            return false;
        }
    }
}

const mailService = new MailService();
export { mailService, MailService };
