import nodemailer from "nodemailer";

export default async function sendEmail(to, code) {
  console.log(process.env.MAIL_USER + "+" + process.env.MAIL_PASS);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject: "Your verification code",
    html: `<p>Your verification code is <b>${code}</b></p>`,
  });
}
