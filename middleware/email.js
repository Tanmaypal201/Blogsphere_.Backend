const { transporter } = require('./emailconfig');

const sendVerify = async (email, verificationCode) => {
  console.log("sendVerify() called");
  console.log("Sending to:", email);
  try {
    const info = await transporter.sendMail({
      from: `"Welcome to Blogging App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is ${verificationCode}`,
      html: `<b>Your verification code is ${verificationCode}</b>`,
    });

    console.log("Email sent:", info.messageId);

  } catch (err) {
    console.log(err);
  }
};

module.exports = { sendVerify };