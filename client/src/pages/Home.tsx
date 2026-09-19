import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Globe2, Heart, ImagePlus, Loader2, MessageCircle, Send, Sparkles, Users, X } from "lucide-react";
import { ensureAnonymousAuth, supabase, type Conversation, type Message, type SessionProfile } from "@/lib/supabase";

type Language = "vi" | "en";
type Step = "welcome" | "gender" | "name" | "year" | "location" | "matching" | "chat" | "closed";
type LegalPage = "privacy" | "terms" | null;
type Form = { gender: string; preferredGender: string; name: string; year: string; country: string; city: string };

const copy = {
  vi: {
    hello: "Stranger Chat",
    intro: "Một cuộc trò chuyện bất ngờ đang chờ bạn.",
    start: "Thử xem nào",
    gender: "Bạn là ai hôm nay?",
    preferredGender: "Bạn muốn tìm kiếm?",
    anyGender: "Bất kỳ giới tính nào",
    name: "Thông tin của bạn",
    year: "Bạn sinh năm nào?",
    yearHint: "Để tụi mình tìm người phù hợp theo lứa tuổi của bạn",
    location: "Bạn đang ở đâu?",
    locationHint: "Để tụi mình tìm người gần khu vực của bạn",
    continue: "Tiếp tục",
    back: "Quay lại",
    matching: "Đang tìm một người lạ",
    matchingHint: "Giữ cửa sổ này mở — chúng mình đang kết nối bạn với thế giới.",
    matched: "Bạn đã gặp một người lạ",
    send: "Gửi",
    placeholder: "Viết điều đầu tiên bạn muốn nói…",
    next: "Người khác",
    end: "Kết thúc",
    empty: "Hãy bắt đầu bằng một lời chào.",
    anonymous: "Ẩn danh",
    noName: "Tên của bạn",
    closedTitle: "Phòng chat đang tạm đóng",
    closedMessage: "Phòng chat đang tạm đóng để nâng cấp và sẽ mở lại khi có thông báo mới.",
    closedHint: "Hãy bật thông báo trình duyệt để nhận tin ngay khi phòng chat mở lại.",
    remind: "Nhắc tôi khi mở cửa",
    reminderTitle: "Nhận nhắc khi phòng mở cửa",
    browser: "Thông báo trình duyệt",
    save: "Bật thông báo",
    close: "Đóng",
    reminderSaved: "Đã lưu lựa chọn nhắc mở cửa.",
  },
  en: {
    hello: "Stranger Chat",
    intro: "A surprising conversation is waiting for you.",
    start: "Try it out",
    gender: "Who are you today?",
    preferredGender: "Who would you like to meet?",
    anyGender: "Any gender",
    name: "About you",
    year: "What year were you born?",
    yearHint: "So we can find someone in a similar age range",
    location: "Where are you?",
    locationHint: "So we can find someone near your part of the world",
    continue: "Continue",
    back: "Back",
    matching: "Finding a stranger",
    matchingHint: "Keep this window open — we're connecting you with the world.",
    matched: "You met a stranger",
    send: "Send",
    placeholder: "Write the first thing you want to say…",
    next: "Next stranger",
    end: "End",
    empty: "Start with a hello.",
    anonymous: "Anonymous",
    noName: "Your name",
    closedTitle: "Chat room temporarily closed",
    closedMessage: "The chat room is temporarily closed for upgrades and will reopen when announced.",
    closedHint: "Enable browser notifications to hear from us as soon as chat reopens.",
    remind: "Remind me when it opens",
    reminderTitle: "Get a reminder when chat opens",
    browser: "Browser notifications",
    save: "Enable notifications",
    close: "Close",
    reminderSaved: "Your reminder preference was saved.",
  },
};


const PUSH_PUBLIC_KEY = "BAm9awV8yCyEnuaeAhGcKehGNThDhXTJBLBpSdZOqA_3hojyCV9RPg2gbOhFtlDSTQTPBsodWnI8HDDjt83Xo1o";
function urlBase64ToUint8Array(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(Array.from(raw).map((character) => character.charCodeAt(0))); }

const countries = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["SG", "Singapore"], ["JP", "Japan"], ["KR", "South Korea"], ["IN", "India"],
  ["DE", "Germany"], ["FR", "France"], ["BR", "Brazil"], ["VN", "Vietnam"],
];

function Flag({ code }: { code: string }) {
  return <span className="text-[1.05rem]" aria-hidden>{code === "VN" ? "🇻🇳" : code === "US" ? "🇺🇸" : code === "GB" ? "🇬🇧" : code === "JP" ? "🇯🇵" : code === "KR" ? "🇰🇷" : code === "SG" ? "🇸🇬" : code === "AU" ? "🇦🇺" : code === "CA" ? "🇨🇦" : code === "IN" ? "🇮🇳" : code === "DE" ? "🇩🇪" : code === "FR" ? "🇫🇷" : code === "BR" ? "🇧🇷" : "🌎"}</span>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? "" : "flex-col gap-4"}`}>
    <div className="logo-mark"><MessageCircle size={compact ? 24 : 38} strokeWidth={1.8} /><span /></div>
    <span className={`brand ${compact ? "text-xl" : "text-3xl"}`}>Stranger Chat</span>
  </div>;
}

export default function Home() {
  const [lang, setLang] = useState<Language>(() => (navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en"));
  const [step, setStep] = useState<Step>("welcome");
  const [form, setForm] = useState<Form>({ gender: "", preferredGender: "any", name: "", year: "", country: "US", city: "" });
  const [session, setSession] = useState<SessionProfile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stepRef = useRef<Step>(step);
  const c = copy[lang];
  const isChatOpen = chatOpen;
  const years = useMemo(() => Array.from({ length: 70 }, (_, i) => String(new Date().getFullYear() - i - 16)), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "vi" ? "Stranger Chat — Trò chuyện với người lạ" : "Stranger Chat — Talk to Strangers Online";
  }, [lang]);
  useEffect(() => {
    void (async () => {
      const { data: setting } = await supabase.from("site_settings").select("chat_open").eq("id", true).single();
      if (setting) setChatOpen(Boolean(setting.chat_open));
      const storageKey = "strangerchat-visitor-id";
      let visitorId = window.localStorage.getItem(storageKey);
      if (!visitorId) { visitorId = crypto.randomUUID(); window.localStorage.setItem(storageKey, visitorId); }
      await supabase.from("site_visits").insert({ visitor_id: visitorId });
    })();
  }, []);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => () => { channelRef.current?.unsubscribe(); }, []);

  const updateForm = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const canContinue = step === "gender" ? !!form.gender : step === "name" ? form.name.trim().length > 0 && !!form.year && !!form.city.trim() : !!form.city.trim();

  const createSessionAndMatch = async () => {
    setBusy(true); setError("");
    let user;
    try { user = await ensureAnonymousAuth(); } catch (authError) { setError(authError instanceof Error ? authError.message : "Could not start a secure session"); setBusy(false); return; }
    const { data: profile, error: insertError } = await supabase.from("anonymous_sessions").upsert({
      id: user.id, display_name: form.name.trim(), gender: form.gender, birth_year: Number(form.year), country_code: form.country, city: form.city.trim(), language: lang,
    }).select().single();
    if (insertError || !profile) { setError(insertError?.message || "Could not start a session"); setBusy(false); return; }
    setSession(profile as SessionProfile);
    const { data: matchRows, error: matchError } = await supabase.rpc("join_match", { p_language: lang, p_country_code: form.country, p_gender_preference: form.preferredGender });
    const match = matchRows?.[0];
    if (matchError) { setError(matchError.message); setBusy(false); return; }
    if (match?.matched && match.conversation_id) { const { data: matched } = await supabase.from("conversations").select().eq("id", match.conversation_id).single(); if (matched) { setConversation(matched as Conversation); setStep("chat"); subscribeToChat(matched.id, profile.id); } }
    else { setStep("matching"); subscribeToMatch(profile.id, form.country, form.preferredGender); }
    setBusy(false);
  };

  const subscribeToMatch = (sessionId: string, selectedCountry = "*", preferredGender = "any") => {
    channelRef.current?.unsubscribe();
    const channel = supabase.channel(`match-${sessionId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations", filter: `participant_a=eq.${sessionId}` }, (payload) => {
      const match = payload.new as Conversation; setConversation(match); setStep("chat"); subscribeToChat(match.id, sessionId);
    }).subscribe();
    channelRef.current = channel;
    const poll = window.setInterval(async () => {
      if (stepRef.current !== "matching") { window.clearInterval(poll); return; }
      const { data } = await supabase.from("conversations").select("*").or(`participant_a.eq.${sessionId},participant_b.eq.${sessionId}`).is("ended_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) { window.clearInterval(poll); setConversation(data as Conversation); setStep("chat"); subscribeToChat(data.id, sessionId); }
    }, 2500);
    if (selectedCountry !== "*") {
      window.setTimeout(async () => {
        if (stepRef.current !== "matching") return;
        const { data: existingMatch } = await supabase.from("conversations").select("id").or(`participant_a.eq.${sessionId},participant_b.eq.${sessionId}`).is("ended_at", null).limit(1).maybeSingle();
        if (existingMatch || stepRef.current !== "matching") return;
        const { data: fallbackRows } = await supabase.rpc("join_match", { p_language: lang, p_country_code: "*", p_gender_preference: preferredGender });
        const fallbackMatch = fallbackRows?.[0];
        if (fallbackMatch?.matched && fallbackMatch.conversation_id && stepRef.current === "matching") {
          const { data: matched } = await supabase.from("conversations").select().eq("id", fallbackMatch.conversation_id).single();
          if (matched) { setConversation(matched as Conversation); setStep("chat"); subscribeToChat(matched.id, sessionId); }
        }
      }, 15000);
    }
  };


  const subscribeToChat = async (conversationId: string, sessionId: string) => {
    channelRef.current?.unsubscribe();
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
    channelRef.current = supabase.channel(`conversation-${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      setMessages((current) => current.some((message) => message.id === payload.new.id) ? current : [...current, payload.new as Message]);
    }).subscribe();
    await supabase.from("anonymous_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || !conversation || !session) return;
    const body = draft.trim(); setDraft("");
    const { data } = await supabase.from("messages").insert({ conversation_id: conversation.id, sender_session_id: session.id, body }).select().single();
    if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
  };

  const sendImage = async (file: File) => {
    if (!conversation || !session || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setImageBusy(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${session.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type, upsert: false });
    if (!uploadError) {
      const { data: publicFile } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { data } = await supabase.from("messages").insert({ conversation_id: conversation.id, sender_session_id: session.id, body: `__image__:${publicFile.publicUrl}` }).select().single();
      if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
    }
    setImageBusy(false);
  };

  const leaveChat = async (next: boolean) => {
    // messages reference conversations with ON DELETE CASCADE, so deleting the
    // conversation permanently removes every message in that room.
    if (conversation) await supabase.rpc("leave_conversation", { p_conversation_id: conversation.id });
    if (session) await supabase.from("match_queue").delete().eq("session_id", session.id);
    channelRef.current?.unsubscribe(); setConversation(null); setMessages([]);
    if (next && session) { setStep("matching"); await supabase.rpc("join_match", { p_language: lang, p_country_code: session.country_code, p_gender_preference: form.preferredGender }); subscribeToMatch(session.id, session.country_code, form.preferredGender); }
    else { setSession(null); setStep("welcome"); }
  };

  const submitStep = () => {
    if (!isChatOpen || !canContinue) return;
    if (step === "name") void createSessionAndMatch();
    else setStep("name");
  };

  if (!isChatOpen) return <ClosedScreen c={c} lang={lang} setLang={setLang} reminderOpen={reminderOpen} setReminderOpen={setReminderOpen} reminderMessage={reminderMessage} setReminderMessage={setReminderMessage} legalPage={legalPage} setLegalPage={setLegalPage} />;
  if (step === "chat") return <ChatView c={c} lang={lang} session={session} messages={messages} sendImage={sendImage} imageBusy={imageBusy} draft={draft} setDraft={setDraft} sendMessage={sendMessage} leaveChat={leaveChat} onLegal={setLegalPage} />;
  if (step === "matching") return <main className="shell matching-shell"><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="top" /><header className="topbar"><Logo compact /><LanguageToggle lang={lang} setLang={setLang} /></header><section className="center-stage matching-stage"><div className="matching-orb"><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-core"><Sparkles size={29} /></div></div><h1>{c.matching}</h1><p>{c.matchingHint}</p><div className="matching-dots"><i /><i /><i /></div><button className="end-button" onClick={() => leaveChat(false)}><X size={15} />{c.end}</button></section><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={setLegalPage} />{legalPage && <LegalModal lang={lang} page={legalPage} onClose={() => setLegalPage(null)} />}</main>;

  return <main className={`shell ${step === "welcome" ? "welcome-shell" : ""}`}><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="top" /><header className="topbar"><Logo compact /><LanguageToggle lang={lang} setLang={setLang} /></header><section className="center-stage wizard-stage">
    {step === "welcome" && <><div className="eyebrow"><Globe2 size={14} /> One world, many stories</div><h1>{c.intro}</h1><p className="welcome-copy">{lang === "vi" ? "Gặp một người bạn chưa từng biết, ở bất cứ đâu trên thế giới." : "Meet someone you've never known, anywhere in the world."}</p><button className="primary-button" onClick={() => setStep("gender")}>{c.start}<span>→</span></button><div className="tiny-note"><Users size={14} /> {lang === "vi" ? "Không cần hồ sơ công khai" : "No public profile needed"}</div></>}
    {step !== "welcome" && <><div className="step-count">0{step === "gender" ? 1 : 2} <span>/ 02</span></div>{step === "gender" && <><h1>{c.gender}</h1><div className="choice-grid"><Choice icon="♀" label={lang === "vi" ? "Nữ" : "Woman"} active={form.gender === "female"} onClick={() => updateForm("gender", "female")} /><Choice icon="♂" label={lang === "vi" ? "Nam" : "Man"} active={form.gender === "male"} onClick={() => updateForm("gender", "male")} /><Choice icon="✦" label={lang === "vi" ? "Khác" : "Other"} active={form.gender === "other"} onClick={() => updateForm("gender", "other")} /></div><h2 className="preference-heading">{c.preferredGender}</h2><div className="choice-grid preference-grid"><Choice icon="✦" label={c.anyGender} active={form.preferredGender === "any"} onClick={() => updateForm("preferredGender", "any")} /><Choice icon="♀" label={lang === "vi" ? "Nữ" : "Woman"} active={form.preferredGender === "female"} onClick={() => updateForm("preferredGender", "female")} /><Choice icon="♂" label={lang === "vi" ? "Nam" : "Man"} active={form.preferredGender === "male"} onClick={() => updateForm("preferredGender", "male")} /><Choice icon="✦" label={lang === "vi" ? "Khác" : "Other"} active={form.preferredGender === "other"} onClick={() => updateForm("preferredGender", "other")} /></div></>}{step === "name" && <><h1>{c.name}</h1><div className="profile-form"><input autoFocus className="large-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder={c.noName} maxLength={40} /><select className="large-input select-input" value={form.year} onChange={(e) => updateForm("year", e.target.value)}><option value="">{lang === "vi" ? "Chọn năm sinh" : "Select birth year"}</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><select className="large-input select-input" value={form.country} onChange={(e) => updateForm("country", e.target.value)}>{countries.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><input className="large-input" value={form.city} onChange={(e) => updateForm("city", e.target.value)} placeholder={lang === "vi" ? "Thành phố" : "City"} /></div><p className="profile-hint">{lang === "vi" ? "Điền nhanh vài thông tin để bắt đầu ghép đôi." : "Add a few details to start matching."}</p></>}{error && <p className="error-text">{error}</p>}<div className="wizard-actions"><button className="text-button" onClick={() => setStep(step === "gender" ? "welcome" : "gender")}>{c.back}</button><button className="primary-button small" disabled={!canContinue || busy} onClick={submitStep}>{busy ? <Loader2 className="spin" size={17} /> : c.continue}<span>→</span></button></div></>}
  </section><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={setLegalPage} />{legalPage && <LegalModal lang={lang} page={legalPage} onClose={() => setLegalPage(null)} />}</main>;
}

function ClosedScreen({ c, lang, setLang, reminderOpen, setReminderOpen, reminderMessage, setReminderMessage, legalPage, setLegalPage }: { c: typeof copy.vi; lang: Language; setLang: (value: Language) => void; reminderOpen: boolean; setReminderOpen: (value: boolean) => void; reminderMessage: string; setReminderMessage: (value: string) => void; legalPage: LegalPage; setLegalPage: (value: LegalPage) => void }) {
  const save = async () => { setReminderMessage(""); if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setReminderMessage("Trình duyệt này không hỗ trợ thông báo đẩy."); return; } const permission = await Notification.requestPermission(); if (permission !== "granted") { setReminderMessage("Bạn chưa cấp quyền thông báo cho trình duyệt."); return; } try { await ensureAnonymousAuth(); const registration = await navigator.serviceWorker.register("/sw.js"); const existing = await registration.pushManager.getSubscription(); const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY) }); const json = subscription.toJSON(); const { error } = await supabase.from("chat_open_reminders").upsert({ channel: "browser", endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, user_agent: navigator.userAgent }, { onConflict: "endpoint" }); if (error) throw error; setReminderMessage(c.reminderSaved); } catch { setReminderMessage("Không thể bật thông báo lúc này. Vui lòng thử lại."); } };
  return <main className="shell closed-shell"><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="top" /><header className="topbar"><Logo compact /><LanguageToggle lang={lang} setLang={setLang} /></header><section className="closed-card"><div className="closed-icon"><Bell size={30} /></div><h1>{c.closedTitle}</h1><p>{c.closedMessage}</p><div className="closed-status"><Bell size={15} /> {lang === "vi" ? "Sẽ thông báo khi mở lại" : "We will notify you when it reopens"}</div><p className="closed-hint">{c.closedHint}</p><button className="primary-button reminder-button" onClick={() => setReminderOpen(true)}><Bell size={17} />{c.remind}</button></section><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={setLegalPage} />{reminderOpen && <div className="legal-backdrop" role="dialog" aria-modal="true"><article className="reminder-modal"><button className="legal-close" onClick={() => setReminderOpen(false)} aria-label={c.close}><X size={20} /></button><h2>{c.reminderTitle}</h2><div className="reminder-options"><div className="reminder-browser-choice"><Bell size={18} />{c.browser}</div></div>{reminderMessage && <p className="profile-hint">{reminderMessage}</p>}<button className="primary-button small legal-ok" onClick={() => void save()}>{c.save}</button></article></div>}{legalPage && <LegalModal lang={lang} page={legalPage} onClose={() => setLegalPage(null)} />}</main>;
}

function AdSlot({ label, variant }: { label: string; variant: "top" | "bottom" | "chat" }) { return <div className={`ad-slot ad-${variant}`} aria-label={label}><a className="deal24h-ad" href="https://deal24h.net/" target="_blank" rel="sponsored noopener noreferrer" aria-label="Visit Deal24h.net for coupons, promo codes and deals"><img src="https://deal24h.net/assets/ads/deal24h-banner-580.webp" srcSet="https://deal24h.net/assets/ads/deal24h-banner-580.webp 580w, https://deal24h.net/assets/ads/deal24h-banner-1161.webp 1161w" sizes="(max-width: 640px) 100vw, 580px" width="580" height="678" alt="DEAL 24H — Big Brands, Real Discounts, All in One Place" loading="lazy" decoding="async" /></a></div>; }

function LegalFooter({ lang, onLegal }: { lang: Language; onLegal: (page: LegalPage) => void }) { return <footer className="footer"><span>© 2026 Stranger Chat</span><span>{lang === "vi" ? "Trò chuyện tử tế · Tôn trọng sự riêng tư" : "Be kind · Respect privacy"}</span><nav className="legal-links"><button onClick={() => onLegal("privacy")}>{lang === "vi" ? "Chính sách bảo mật" : "Privacy Policy"}</button><button onClick={() => onLegal("terms")}>{lang === "vi" ? "Điều khoản sử dụng" : "Terms of Use"}</button></nav></footer>; }

function LegalModal({ lang, page, onClose }: { lang: Language; page: Exclude<LegalPage, null>; onClose: () => void }) { const privacy = page === "privacy"; return <div className="legal-backdrop" role="dialog" aria-modal="true" aria-label={privacy ? "Privacy Policy" : "Terms of Use"}><article className="legal-modal"><button className="legal-close" onClick={onClose} aria-label="Close">×</button><div className="eyebrow">Stranger Chat</div><h2>{privacy ? (lang === "vi" ? "Chính sách bảo mật" : "Privacy Policy") : (lang === "vi" ? "Điều khoản sử dụng" : "Terms of Use")}</h2>{privacy ? <><p>{lang === "vi" ? "Chúng tôi chỉ sử dụng thông tin cần thiết để ghép đôi và duy trì cuộc trò chuyện. Không chia sẻ thông tin cá nhân của bạn với người khác trong hồ sơ công khai." : "We use only the information needed to match you and maintain a conversation. Your personal details are not shown in a public profile."}</p><p>{lang === "vi" ? "Tin nhắn và dữ liệu phiên có thể được lưu tạm thời để vận hành dịch vụ, chống spam và xử lý báo cáo. Bạn không nên chia sẻ số điện thoại, mật khẩu hoặc thông tin nhạy cảm." : "Messages and session data may be stored temporarily to operate the service, prevent spam, and handle reports. Do not share phone numbers, passwords, or sensitive information."}</p></> : <><p>{lang === "vi" ? "Bạn đồng ý sử dụng dịch vụ một cách văn minh, không quấy rối, lừa đảo, đe dọa hoặc chia sẻ nội dung bất hợp pháp." : "You agree to use the service respectfully and not to harass, scam, threaten, or share illegal content."}</p><p>{lang === "vi" ? "Dịch vụ dành cho người dùng đủ độ tuổi theo pháp luật nơi bạn sống. Hãy kết thúc và báo cáo cuộc trò chuyện nếu cảm thấy không an toàn." : "The service is for users who meet the minimum age required where they live. End and report a conversation if you feel unsafe."}</p></>}<button className="primary-button small legal-ok" onClick={onClose}>{lang === "vi" ? "Đã hiểu" : "Got it"}</button></article></div>; }

function Choice({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) { return <button className={`choice-card ${active ? "active" : ""}`} onClick={onClick}><span className="choice-icon">{icon}</span><span>{label}</span>{active && <span className="choice-check">✓</span>}</button>; }
function LanguageToggle({ lang, setLang }: { lang: Language; setLang: (language: Language) => void }) { return <div className="language-toggle"><button className={lang === "vi" ? "active" : ""} onClick={() => setLang("vi")}><Flag code="VN" /> VI</button><button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}><Flag code="US" /> EN</button></div>; }
function ChatView({ c, lang, session, messages, draft, setDraft, sendMessage, sendImage, imageBusy, leaveChat, onLegal }: { c: typeof copy.vi; lang: Language; session: SessionProfile | null; messages: Message[]; draft: string; setDraft: (value: string) => void; sendMessage: (event: FormEvent) => void; sendImage: (file: File) => void; imageBusy: boolean; leaveChat: (next: boolean) => void; onLegal: (page: LegalPage) => void }) { return <main className="chat-shell"><header className="chat-topbar"><Logo compact /><div className="chat-status"><span className="status-dot" /> {c.matched}</div><LanguageToggle lang={lang} setLang={() => undefined} /></header><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="chat" /><section className="chat-card"><div className="chat-card-head"><div className="stranger-avatar"><Heart size={19} /></div><div><strong>{c.anonymous}</strong><span>{lang === "vi" ? "Một người ở đâu đó trên thế giới" : "Someone, somewhere in the world"}</span></div><button className="close-button" onClick={() => leaveChat(false)} aria-label={c.end}><X size={18} /></button></div><div className="chat-retention-notice">{lang === "vi" ? "Tin nhắn sẽ bị xóa vĩnh viễn khi bạn thoát hoặc chọn người khác." : "Messages are permanently deleted when you leave or choose another stranger."}</div><div className="messages"><div className="conversation-intro"><div className="intro-line" /><p>{c.empty}</p><div className="intro-line" /></div>{messages.map((message) => <div key={message.id} className={`message-row ${message.sender_session_id === session?.id ? "mine" : "theirs"}`}><div className="message-bubble">{message.body.startsWith("__image__:") ? <img className="chat-image" src={message.body.slice(10)} alt={lang === "vi" ? "Ảnh đã gửi" : "Shared image"} loading="lazy" /> : message.body}</div><time>{new Date(message.created_at).toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div><form className="composer" onSubmit={sendMessage}><label className="image-button" aria-label={lang === "vi" ? "Gửi hình ảnh" : "Send image"}><ImagePlus size={18} /><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void sendImage(file); e.currentTarget.value = ""; }} disabled={imageBusy} /></label><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={c.placeholder} maxLength={2000} /><button type="submit" aria-label={c.send}><Send size={18} /></button></form></section><div className="chat-actions"><button className="secondary-button" onClick={() => leaveChat(true)}>{c.next}<span>↗</span></button><button className="text-button" onClick={() => leaveChat(false)}>{c.end}</button></div><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={onLegal} /></main>; }
