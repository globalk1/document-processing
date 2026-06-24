const STORAGE_KEY = "huanyu-document-processing-ai-request-quota";
export const DAILY_AI_REQUEST_LIMIT = 70;

let memoryRecord = null;

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readRecord() {
  const today = localDateKey();

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.date === today && Number.isInteger(stored.count)) {
      return { date: today, count: Math.max(0, stored.count) };
    }
  } catch {
    // localStorage may be unavailable in private or restricted browser modes.
  }

  if (memoryRecord?.date === today) return memoryRecord;
  return { date: today, count: 0 };
}

function writeRecord(record) {
  memoryRecord = record;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Keep the in-memory fallback for the current tab.
  }
  window.dispatchEvent(new CustomEvent("document-processing-quota-change"));
}

export function getDailyAiRequestQuota() {
  const record = readRecord();
  return {
    limit: DAILY_AI_REQUEST_LIMIT,
    used: record.count,
    remaining: Math.max(0, DAILY_AI_REQUEST_LIMIT - record.count),
  };
}

export function consumeDailyAiRequest() {
  const quota = getDailyAiRequestQuota();
  if (quota.remaining <= 0) {
    return { allowed: false, ...quota };
  }

  const record = {
    date: localDateKey(),
    count: quota.used + 1,
  };
  writeRecord(record);

  return {
    allowed: true,
    limit: DAILY_AI_REQUEST_LIMIT,
    used: record.count,
    remaining: DAILY_AI_REQUEST_LIMIT - record.count,
  };
}
