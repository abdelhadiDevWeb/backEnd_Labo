import nodemailer from "nodemailer";

// Check if email credentials are configured
const isEmailConfigured = (): boolean => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Create reusable transporter (only if credentials are configured)
let transporter: nodemailer.Transporter | null = null;

if (isEmailConfigured()) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error("Email transporter error:", error);
      console.error("Please check your SMTP configuration in .env file");
    } else {
      console.log("Email server is ready to send messages");
    }
  });
} else {
  console.warn("⚠️  Email service not configured. SMTP_USER and SMTP_PASS are required in .env file");
  console.warn("   Password reset emails will not be sent until email is configured.");
}

// Send password reset code email
export const sendPasswordResetCode = async (email: string, code: string): Promise<boolean> => {
  try {
    // Check if email is configured
    if (!isEmailConfigured() || !transporter) {
      console.error("Email service not configured. Cannot send password reset code.");
      console.error("Please configure SMTP_USER and SMTP_PASS in your .env file");
      return false;
    }

    const mailOptions = {
      from: `"Market Lab" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Code de réinitialisation de mot de passe",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Réinitialisation de mot de passe</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Market Lab</h1>
            </div>
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1f2937; margin-top: 0;">Réinitialisation de mot de passe</h2>
              <p style="color: #4b5563;">Vous avez demandé à réinitialiser votre mot de passe. Utilisez le code suivant pour continuer :</p>
              <div style="background: #f3f4f6; border: 2px dashed #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #16a34a; font-family: 'Courier New', monospace;">
                  ${code}
                </div>
              </div>
              <p style="color: #4b5563; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Market Lab. Tous droits réservés.</p>
            </div>
          </body>
        </html>
      `,
      text: `Votre code de réinitialisation de mot de passe est : ${code}\n\nCe code est valide pendant 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    if (error.code === "EAUTH") {
      console.error("Authentication failed. Please check your SMTP credentials in .env file:");
      console.error("  - SMTP_USER:", process.env.SMTP_USER ? "✓ Set" : "✗ Missing");
      console.error("  - SMTP_PASS:", process.env.SMTP_PASS ? "✓ Set" : "✗ Missing");
    }
    return false;
  }
};

// Send problem notification email to company
export const sendProblemNotificationEmail = async (
  email: string,
  phone: string,
  message: string
): Promise<boolean> => {
  try {
    // Check if email is configured
    if (!isEmailConfigured() || !transporter) {
      console.error("Email service not configured. Cannot send problem notification email.");
      console.error("Please configure SMTP_USER and SMTP_PASS in your .env file");
      return false;
    }

    const companyEmail = "hadiabdou721@gmail.com";

    const mailOptions = {
      from: `"Market Lab" <${process.env.SMTP_USER}>`,
      to: companyEmail,
      subject: "Nouveau message de support - Market Lab",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nouveau message de support</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Market Lab</h1>
            </div>
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1f2937; margin-top: 0;">Nouveau message de support</h2>
              <p style="color: #4b5563;">Un utilisateur a envoyé un nouveau message de support :</p>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="margin-bottom: 15px;">
                  <strong style="color: #1f2937;">Email :</strong>
                  <span style="color: #4b5563; margin-left: 10px;">${email}</span>
                </div>
                <div style="margin-bottom: 15px;">
                  <strong style="color: #1f2937;">Téléphone :</strong>
                  <span style="color: #4b5563; margin-left: 10px;">${phone}</span>
                </div>
                <div>
                  <strong style="color: #1f2937; display: block; margin-bottom: 10px;">Message :</strong>
                  <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; color: #4b5563; white-space: pre-wrap;">
${message}
                  </div>
                </div>
              </div>

              <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                Vous pouvez consulter ce message dans le tableau de bord administrateur.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Market Lab. Tous droits réservés.</p>
            </div>
          </body>
        </html>
      `,
      text: `Nouveau message de support - Market Lab

Email: ${email}
Téléphone: ${phone}

Message:
${message}

Vous pouvez consulter ce message dans le tableau de bord administrateur.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Problem notification email sent:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Error sending problem notification email:", error);
    if (error.code === "EAUTH") {
      console.error("Authentication failed. Please check your SMTP credentials in .env file:");
      console.error("  - SMTP_USER:", process.env.SMTP_USER ? "✓ Set" : "✗ Missing");
      console.error("  - SMTP_PASS:", process.env.SMTP_PASS ? "✓ Set" : "✗ Missing");
    }
    return false;
  }
};
