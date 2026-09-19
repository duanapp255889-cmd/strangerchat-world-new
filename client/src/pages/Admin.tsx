import { FormEvent, useEffect, useState } from "react";
import { Bell, LogOut, RefreshCw, Users, Wifi, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stats = { reminders: number; visits: number; chatOpen: boolean; updatedAt: string | null };
const ADMIN_REDIRECT_URL = "https://strangerchat.world/admin";

export default function Admin() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    const currentEmail = user?.email?.toLowerCase() || null;
    setUserEmail(currentEmail);
    if (!currentEmail) { setAuthorized(false); setBusy(false); return; }
    const { data: admin } = await supabase.from("admin_users").select("email").eq("email", currentEmail).maybeSingle();
    if (!admin) { setAuthorized(false); setMessage("Tài khoản này chưa được cấp quyền quản trị."); setBusy(false); return; }
    setAuthorized(true);
    const [{ count: reminders }, { count: visits }, { data: settings }] = await Promise.all([
      supabase.from("chat_open_reminders").select("id", { count: "exact", head: true }).eq("channel", "browser").not("endpoint", "is", null),
      supabase.from("site_visits").select("id", { count: "exact", head: true }),
      supabase.from("site_settings").select("chat_open,updated_at").eq("id", true).single(),
    ]);
    setStats({ reminders: reminders || 0, visits: visits || 0, chatOpen: !!settings?.chat_open, updatedAt: settings?.updated_at || null });
    setBusy(false);
  };

  useEffect(() => { void load(); }, []);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: ADMIN_REDIRECT_URL } });
    setMessage(error ? error.message : "Đã gửi liên kết đăng nhập. Hãy kiểm tra email của bạn."); setBusy(false);
  };

  const toggleChat = async () => {
    if (!stats || !userEmail) return;
    setBusy(true); setMessage("");
    const next = !stats.chatOpen;
    const { error } = await supabase.from("site_settings").update({ chat_open: next, updated_at: new Date().toISOString(), updated_by: userEmail }).eq("id", true);
    if (error) setMessage(error.message); else setStats({ ...stats, chatOpen: next, updatedAt: new Date().toISOString() });
    setBusy(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); setUserEmail(null); setAuthorized(false); setStats(null); };

  if (!authorized) return <main className="admin-shell"><section className="admin-login"><div className="admin-kicker">STRANGER CHAT · ADMIN</div><h1>Đăng nhập quản trị</h1><p>Chỉ tài khoản quản trị được cấp quyền mới có thể xem số liệu và điều khiển phòng chat.</p><form onSubmit={sendMagicLink}><input className="large-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email quản trị" /><button className="primary-button admin-button" disabled={busy}>{busy ? "Đang gửi…" : "Gửi liên kết đăng nhập"}</button></form>{message && <div className="admin-message">{message}</div>}<a className="admin-home-link" href="/">← Về trang chính</a></section></main>;

  return <main className="admin-shell"><div className="admin-wrap"><header className="admin-header"><div><div className="admin-kicker">STRANGER CHAT · ADMIN</div><h1>Bảng điều khiển</h1><p>{userEmail}</p></div><div className="admin-header-actions"><button className="admin-icon-button" onClick={() => void load()} disabled={busy} aria-label="Làm mới"><RefreshCw size={17} /></button><button className="admin-icon-button" onClick={() => void signOut()} aria-label="Đăng xuất"><LogOut size={17} /></button></div></header><section className="admin-control"><div><span className={`admin-status-dot ${stats?.chatOpen ? "open" : "closed"}`} /><strong>{stats?.chatOpen ? "Phòng chat đang mở" : "Phòng chat đang đóng"}</strong><p>{stats?.chatOpen ? "Người dùng có thể bắt đầu ghép đôi." : "Người dùng chỉ thấy màn hình chờ và nút đăng ký thông báo."}</p></div><button className={`admin-toggle ${stats?.chatOpen ? "is-open" : ""}`} onClick={() => void toggleChat()} disabled={busy}><span>{stats?.chatOpen ? "Đóng phòng chat" : "Mở phòng chat"}</span>{stats?.chatOpen ? <Wifi size={17} /> : <X size={17} />}</button></section><section className="admin-stats"><article><Bell size={22} /><span>Đăng ký Push</span><strong>{stats?.reminders ?? "—"}</strong><small>Subscription trình duyệt</small></article><article><Users size={22} /><span>Lượt truy cập</span><strong>{stats?.visits ?? "—"}</strong><small>Thiết bị/trình duyệt đã ghi nhận</small></article><article><Wifi size={22} /><span>Trạng thái</span><strong>{stats?.chatOpen ? "Mở" : "Đóng"}</strong><small>Cập nhật theo công tắc</small></article></section>{message && <div className="admin-message">{message}</div>}<p className="admin-note">Số Push chỉ tính subscription đã cấp quyền và lưu thành công. Lượt truy cập được ghi nhận 1 lần trên mỗi trình duyệt.</p><a className="admin-home-link" href="/">← Về trang chính</a></div></main>;
}
