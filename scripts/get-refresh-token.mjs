/**
 * Google OAuth2 リフレッシュトークン取得スクリプト
 *
 * 使い方:
 *   node scripts/get-refresh-token.mjs
 *
 * 事前準備:
 *   1. スクリプト内の CLIENT_ID / CLIENT_SECRET を入力して実行
 *   2. 表示されたURLをブラウザで開く
 *   3. ai-asset-sales@extra-company.jp でログイン・許可
 *   4. リダイレクト先URLの ?code=XXXX をここに貼る
 *   5. 表示された refresh_token を Vercel 環境変数に設定
 */

import { createInterface } from "readline";
import { google } from "googleapis";

// ── ここに Google Cloud Console から取得した値を入力 ──────────
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? "★ここに貼る★";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "★ここに貼る★";
// ─────────────────────────────────────────────────────────

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // コピペ方式

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  prompt: "consent", // 必ず refresh_token を返させる
});

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📋 Step 1: 以下のURLをブラウザで開いてください");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(authUrl);
console.log("");
console.log("👤 ai-asset-sales@extra-company.jp でログイン → 「許可」");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

rl.question("📋 Step 2: 表示された認証コードを貼り付けてください: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log("\n✅ 取得成功！\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Vercel 環境変数に以下を設定してください");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`GOOGLE_CLIENT_ID     = ${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET = ${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (err) {
    console.error("❌ エラー:", err.message);
  }
});
