import tls from "node:tls";

type EmailInput = { to: string; subject: string; html: string };
type SmtpReply = { code: number; text: string };

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export async function sendSmtpEmail({ to, subject, html }: EmailInput): Promise<void> {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Chi Tiêu";
  if (!username || !password || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SMTP chưa được cấu hình đầy đủ.");
  if (/\r|\n/.test(username) || /\r|\n/.test(to) || /\r|\n/.test(fromName))
    throw new Error("Thông tin địa chỉ email không hợp lệ.");

  const socket = tls.connect({ host, port, servername: host });
  socket.setTimeout(12_000, () => socket.destroy(new Error("SMTP connection timed out.")));
  let buffer = "";
  let lines: string[] = [];
  let responseQueue: SmtpReply[] = [];
  let responseWaiters: Array<(reply: SmtpReply) => void> = [];
  let socketError: Error | null = null;
  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let boundary = buffer.indexOf("\r\n");
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        const reply: SmtpReply = { code: Number(line.slice(0, 3)), text: lines.join("\n") };
        lines = [];
        const waiter = responseWaiters.shift();
        if (waiter) waiter(reply);
        else responseQueue.push(reply);
      }
      boundary = buffer.indexOf("\r\n");
    }
  };
  socket.on("data", onData);
  socket.on("error", (error) => {
    socketError = error;
    const waiters = responseWaiters;
    responseWaiters = [];
    waiters.forEach((waiter) => waiter({ code: 0, text: error.message }));
  });
  const nextReply = (): Promise<SmtpReply> => {
    const queued = responseQueue.shift();
    if (queued) return Promise.resolve(queued);
    if (socketError) return Promise.resolve({ code: 0, text: socketError.message });
    return new Promise((resolve) => responseWaiters.push(resolve));
  };
  const command = async (value: string, allowed: number[]) => {
    const replyPromise = nextReply();
    socket.write(`${value}\r\n`);
    const reply = await replyPromise;
    if (!allowed.includes(reply.code)) throw new Error(`SMTP ${reply.code}: ${reply.text}`);
    return reply;
  };
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    const greeting = await nextReply();
    if (greeting.code !== 220) throw new Error(`SMTP ${greeting.code}: ${greeting.text}`);
    await command("EHLO localhost", [250]);
    await command("AUTH LOGIN", [334]);
    await command(Buffer.from(username, "utf8").toString("base64"), [334]);
    await command(Buffer.from(password, "utf8").toString("base64"), [235]);
    await command(`MAIL FROM:<${username}>`, [250]);
    await command(`RCPT TO:<${to}>`, [250, 251]);
    await command("DATA", [354]);

    const from = `${encodeHeader(fromName)} <${username}>`;
    const body = wrapBase64(html).replace(/^\./gm, "..");
    const message = [
      `From: ${from}`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      body,
      ".",
      "",
    ].join("\r\n");
    const sentPromise = nextReply();
    socket.write(message);
    const sent = await sentPromise;
    if (sent.code !== 250) throw new Error(`SMTP ${sent.code}: ${sent.text}`);
    await command("QUIT", [221]);
  } finally {
    socket.end();
  }
}
