import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { marked } from "marked";

type EmailRequest = {
  to: string;
  subject: string;
  markdown: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailRequest;
    if (!body.to || !body.subject || !body.markdown) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM = SMTP_USER,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing SMTP env vars. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.",
        },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const html = marked.parse(body.markdown);

    await transporter.sendMail({
      from: SMTP_FROM,
      to: body.to,
      subject: body.subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

