export default async function handler(req, res) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const garageNumber = process.env.TWILIO_NUMBER;

  if (!sid || !token || !garageNumber) {
    res.status(500).json({ error: "Missing Twilio environment variables." });
    return;
  }

  const authHeader = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");

  async function fetchDirection(param) {
    const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`);
    url.searchParams.set(param, garageNumber);
    url.searchParams.set("PageSize", "100");

    const response = await fetch(url, { headers: { Authorization: authHeader } });
    if (!response.ok) {
      throw new Error(`Twilio error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    return data.messages || [];
  }

  try {
    const [sentByGarage, sentToGarage] = await Promise.all([
      fetchDirection("From"),
      fetchDirection("To"),
    ]);

    const combined = [...sentByGarage, ...sentToGarage].map((m) => ({
      sid: m.sid,
      from: m.from,
      to: m.to,
      body: m.body,
      dateSent: m.date_sent || m.date_created,
    }));

    const seen = new Set();
    const deduped = combined.filter((m) => {
      if (seen.has(m.sid)) return false;
      seen.add(m.sid);
      return true;
    });

    deduped.sort((a, b) => new Date(a.dateSent) - new Date(b.dateSent));

    res.status(200).json({ garageNumber, messages: deduped });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
