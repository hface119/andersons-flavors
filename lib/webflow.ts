const API_BASE = "https://api.webflow.com/v2";

function headers() {
  return {
    Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

export async function webflowGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webflow GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function webflowPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webflow POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function webflowPatch(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webflow PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function webflowDelete(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webflow DELETE ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}
