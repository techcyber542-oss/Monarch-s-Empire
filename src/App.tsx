import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  Activity, ArrowDown, Bell, Check, ChevronDown, Crown, Ellipsis, Hash,
  ImagePlus, LockKeyhole, LogOut, Menu, MessageCircle, MoreHorizontal, Pin,
  Plus, Search, Send, Settings, Shield, ShieldAlert, Smile, Sparkles, Sticker,
  Trash2, Users, X, Zap, PanelLeftClose, AtSign
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  banner_url: string | null
  avatar_effect: string
  role: 'member' | 'moderator' | 'owner'
  status: string
}
type ChatMessage = {
  id: string
  room_id: string
  user_id: string
  content: string
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  profile?: Profile
  reactions?: Record<string, string[]>
}
const EMOJIS = ['😀','😂','🥹','😍','🔥','💜','⚔️','✨','😭','👑','🖤','💀','🙌','💯','🤝','🫡']
const STICKERS = [
  { emoji: '👑', label: 'Monarch' }, { emoji: '⚔️', label: 'Shadow blade' },
  { emoji: '🌑', label: 'Eclipse' }, { emoji: '🐉', label: 'Dragon' },
  { emoji: '💜', label: 'Purple aura' }, { emoji: '🔥', label: 'Awakened' }
]
const ROOMS = [
  { id: 'general', name: 'general', description: 'The gathering hall' },
  { id: 'introductions', name: 'introductions', description: 'Meet the guild' },
  { id: 'media', name: 'media', description: 'Art, clips and creations' },
  { id: 'announcements', name: 'announcements', description: 'Messages from the throne' }
]
const DEMO_MESSAGES: ChatMessage[] = [
  { id: 'demo-1', room_id: 'general', user_id: 'system', content: 'Welcome to the Empire. Your awakening begins here. ✨', created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), profile: { id: 'system', username: 'system', display_name: 'System Oracle', avatar_url: null, banner_url: null, avatar_effect: 'royal', role: 'owner', status: 'Watching the realm' } },
  { id: 'demo-2', room_id: 'general', user_id: 'shadow', content: 'The new realm is looking clean 👑💜', created_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(), profile: { id: 'shadow', username: 'shadow', display_name: 'Shadow Monarch', avatar_url: null, banner_url: null, avatar_effect: 'aura', role: 'moderator', status: 'In the shadows' } },
  { id: 'demo-3', room_id: 'general', user_id: 'you', content: 'The gates are open. Who is ready? ⚔️', created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(), profile: { id: 'you', username: 'you', display_name: 'You', avatar_url: null, banner_url: null, avatar_effect: 'royal', role: 'member', status: 'Ready to raid' } }
]
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'M'
const formatTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function Avatar({ profile, size = 'md', online = false }: { profile?: Partial<Profile> | null; size?: 'sm'|'md'|'lg'; online?: boolean }) {
  const name = profile?.display_name || profile?.username || 'Monarch'
  const effect = profile?.avatar_effect || 'aura'
  return <span className={`avatar avatar-${size} effect-${effect}`}>
    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initials(name)}</span>}
    {online && <i className="online-dot" />}
  </span>
}
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="modal glass-panel" role="dialog" aria-modal="true">
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
      {children}
    </section>
  </div>
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES)
  const [activeRoom, setActiveRoom] = useState('general')
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showModeration, setShowModeration] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [sending, setSending] = useState(false)
  const [bannerUrl, setBannerUrl] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarEffect, setAvatarEffect] = useState('aura')
  const [statusText, setStatusText] = useState('Ready to raid')
  const [onlineUsers, setOnlineUsers] = useState(12)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [darkPurple, setDarkPurple] = useState(true)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [messageMenu, setMessageMenu] = useState<string | null>(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'demo'|'connecting'|'live'|'offline'>('demo')
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [reports, setReports] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const room = ROOMS.find(r => r.id === activeRoom) || ROOMS[0]
  const canModerate = profile?.role === 'owner' || profile?.role === 'moderator'
  const isOwner = profile?.role === 'owner'

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => {
    if (!supabase || !supabaseConfigured) { setSessionReady(true); setConnectionStatus('demo'); return }
    const client = supabase
let alive = true
    const boot = async () => {
      setConnectionStatus('connecting')
      const { data: { session } } = await supabase.auth.getSession()
      if (!alive) return
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        if (data) setProfile(data as Profile)
        else {
          const newProfile = { id: session.user.id, username: `monarch_${session.user.id.slice(0, 6)}`, display_name: 'New Monarch', avatar_url: null, banner_url: null, avatar_effect: 'aura', role: 'member', status: 'New to the realm' }
          const { data: inserted } = await supabase.from('profiles').upsert(newProfile).select().single()
          if (inserted) setProfile(inserted as Profile)
        }
      }
      setSessionReady(true)
      setConnectionStatus('live')
    }
    void boot()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!supabase || !supabaseConfigured || !profile) return
    let alive = true
    const load = async () => {
      const { data, error } = await supabase.from('messages')
        .select('id, room_id, user_id, content, created_at, edited_at, deleted_at, profiles(id, username, display_name, avatar_url, banner_url, avatar_effect, role, status)')
        .eq('room_id', activeRoom).is('deleted_at', null).order('created_at', { ascending: true }).limit(150)
      if (!alive) return
      if (!error && data) {
        const mapped = data.map((m: any) => ({ ...m, profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles })) as ChatMessage[]
        setMessages(prev => [...prev.filter(m => m.id.startsWith('demo-') && activeRoom === 'general'), ...mapped])
      }
    }
    void load()
    const channel = supabase.channel(`room:${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom}` }, async payload => {
        const m = payload.new as ChatMessage
        const { data: p } = await supabase.from('profiles').select('*').eq('id', m.user_id).maybeSingle()
        if (alive) setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, { ...m, profile: p as Profile }])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom}` }, payload => {
        const updated = payload.new as ChatMessage
        if (alive) setMessages(prev => updated.deleted_at ? prev.filter(m => m.id !== updated.id) : prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom}` }, payload => {
        const old = payload.old as ChatMessage
        if (alive) setMessages(prev => prev.filter(m => m.id !== old.id))
      })
      .subscribe(status => {
        if (alive && status === 'SUBSCRIBED') setConnectionStatus('live')
        if (alive && status === 'CHANNEL_ERROR') setConnectionStatus('offline')
      })
    return () => { alive = false; void supabase.removeChannel(channel) }
  }, [activeRoom, profile])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [messages, activeRoom, reducedMotion])

  const filteredMessages = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return messages.filter(m => m.room_id === activeRoom && (!q || m.content.toLowerCase().includes(q)))
  }, [messages, activeRoom, searchText])
  const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id))

  const enterRealm = async (e: FormEvent) => {
    e.preventDefault()
    const cleanUser = username.trim().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
    if (!cleanUser) { notify('Choose a username first.'); return }
    const cleanDisplay = displayName.trim().slice(0, 28) || cleanUser
    if (!supabase || !supabaseConfigured) {
      const demoProfile: Profile = { id: 'local-' + cleanUser.toLowerCase(), username: cleanUser, display_name: cleanDisplay, avatar_url: null, banner_url: null, avatar_effect: 'aura', role: 'member', status: 'Awakened' }
      setProfile(demoProfile); setSessionReady(true); notify('Demo profile awakened. Connect Supabase for shared live chat.')
      return
    }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) { notify(error?.message || 'Could not enter the realm.'); return }
    const p = { id: data.user.id, username: cleanUser, display_name: cleanDisplay, avatar_url: null, banner_url: null, avatar_effect: 'aura', role: 'member', status: 'Awakened' }
    const { data: saved, error: profileError } = await supabase.from('profiles').upsert(p).select().single()
    if (profileError) { notify(profileError.message); return }
    setProfile(saved as Profile); notify('Welcome to the Empire.')
  }

  const sendMessage = async (contentOverride?: string) => {
    const content = (contentOverride ?? draft).trim()
    if (!content || sending) return
    if (!profile) { notify('Enter the realm before sending messages.'); return }
    setSending(true)
    const replyPrefix = replyTo ? `↪ Replying to ${replyTo.profile?.display_name || 'a monarch'}: ${replyTo.content.slice(0, 90)}\n\n` : ''
    if (supabase && supabaseConfigured && !profile.id.startsWith('local-')) {
      const payload: Record<string, unknown> = { room_id: activeRoom, user_id: profile.id, content: replyPrefix + content }
      if (editingMessage) {
        const { error } = await supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', editingMessage).eq('user_id', profile.id)
        if (error) notify(error.message)
        else { setMessages(prev => prev.map(m => m.id === editingMessage ? { ...m, content, edited_at: new Date().toISOString() } : m)); notify('Message updated.') }
        setEditingMessage(null)
      } else {
        const { data, error } = await supabase.from('messages').insert(payload).select('id, room_id, user_id, content, created_at, edited_at, deleted_at').single()
        if (error) notify(error.message)
        else if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, { ...data, profile } as ChatMessage])
      }
    } else {
      if (editingMessage) {
        setMessages(prev => prev.map(m => m.id === editingMessage ? { ...m, content, edited_at: new Date().toISOString() } : m))
        setEditingMessage(null)
      } else {
        const m: ChatMessage = { id: `local-${Date.now()}`, room_id: activeRoom, user_id: profile.id, content: replyPrefix + content, created_at: new Date().toISOString(), profile }
        setMessages(prev => [...prev, m])
      }
    }
    setDraft(''); setReplyTo(null); setShowEmoji(false); setShowStickers(false); setSending(false)
  }

  const deleteMessage = async (message: ChatMessage) => {
    if (!profile || (message.user_id !== profile.id && !canModerate)) { notify('You can only delete your own messages.'); return }
    if (supabase && supabaseConfigured && !message.id.startsWith('local-') && !message.id.startsWith('demo-')) {
      const query = supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id)
      const { error } = await query
      if (error) { notify(error.message); return }
    }
    setMessages(prev => prev.filter(m => m.id !== message.id))
    setMessageMenu(null); notify('Message removed.')
  }

  const clearChat = async () => {
    if (!profile) return
    if (supabase && supabaseConfigured && isOwner) {
      const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('room_id', activeRoom)
      if (error) { notify(error.message); setShowConfirmClear(false); return }
    }
    setMessages(prev => prev.filter(m => m.room_id !== activeRoom))
    setShowConfirmClear(false)
    notify(isOwner ? 'Room cleared.' : 'Cleared from your current view.')
  }

  const reactToMessage = async (message: ChatMessage, emoji: string) => {
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, reactions: { ...(m.reactions || {}), [emoji]: [...(m.reactions?.[emoji] || []), profile?.id || 'guest'] } } : m))
    setMessageMenu(null)
  }

  const handleImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('Choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { notify('Images must be 5 MB or smaller.'); return }
    if (!supabase || !supabaseConfigured || !profile || profile.id.startsWith('local-')) {
      notify('Image upload needs your Supabase profile and configured storage bucket.'); return
    }
    const ext = file.name.split('.').pop() || 'png'
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false, contentType: file.type })
    if (error) { notify(error.message); return }
    const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
    await sendMessage(`🖼️ ${data.publicUrl}`)
    notify('Image sent.')
  }

  const runCommand = (raw: string) => {
    const [command, ...rest] = raw.trim().split(/\s+/)
    const arg = rest.join(' ')
    if (command === '/help') { notify('/help · /clear · /announce (moderators only)'); return true }
    if (command === '/clear') { setShowConfirmClear(true); return true }
    if (command === '/announce') {
      if (!canModerate) { notify('Only moderators can announce.'); return true }
      if (!arg) { notify('Usage: /announce your message'); return true }
      void sendMessage(`📢 EMPIRE ANNOUNCEMENT: ${arg}`); return true
    }
    if (command === '/report') { notify('Use the message menu to report a message.'); return true }
    return false
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.startsWith('/') && runCommand(draft)) { setDraft(''); return }
    void sendMessage()
  }
  const onComposerKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setEditingMessage(null); setReplyTo(null); setDraft('') }
  }

  const updateProfile = async () => {
    if (!profile) return
    const patch = { display_name: displayName.trim() || profile.display_name, status: statusText, avatar_url: avatarUrl.trim() || null, banner_url: bannerUrl.trim() || null, avatar_effect: avatarEffect }
    if (supabase && supabaseConfigured && !profile.id.startsWith('local-')) {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', profile.id).select().single()
      if (error) { notify(error.message); return }
      setProfile(data as Profile)
    } else setProfile({ ...profile, ...patch })
    setShowProfile(false); notify('Profile updated.')
  }

  const signOut = async () => {
    if (supabase && supabaseConfigured) await supabase.auth.signOut()
    setProfile(null); setSessionReady(true); notify('You left the realm.')
  }

  return <main className={`app-shell ${reducedMotion ? 'reduce-motion' : ''} ${compactMode ? 'compact-mode' : ''} ${darkPurple ? '' : 'blue-theme'}`}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <div className="starfield" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 8) * -.7}s` }} />)}</div>
    <header className="topbar glass-panel">
      <button className="brand-lockup" onClick={() => setActiveRoom('general')} aria-label="Monarchs Empire home">
        <span className="brand-mark"><Crown size={21} strokeWidth={1.8}/><i /></span>
        <span className="brand-copy"><strong>MONARCHS <em>EMPIRE</em></strong><small>THE SHADOW REALM</small></span>
      </button>
      <div className="topbar-center"><span className="realm-indicator"><span className="pulse-dot" /> REALM STATUS</span><span className="topbar-divider" /><span className="topbar-live">{connectionStatus === 'live' ? 'REALTIME CONNECTED' : connectionStatus === 'connecting' ? 'CONNECTING…' : connectionStatus === 'offline' ? 'RECONNECT NEEDED' : 'PREVIEW MODE'}</span></div>
      <div className="topbar-actions">
        <button className="icon-button search-trigger" title="Search messages" onClick={() => setShowSearch(v => !v)}><Search size={18}/></button>
        <button className="icon-button notification-button" title="Notifications" onClick={() => notify('You are all caught up.')}><Bell size={18}/><i /></button>
        <button className="profile-trigger" onClick={() => profile ? setShowProfile(true) : notify('Enter the realm below to create your profile.')}>
          <Avatar profile={profile} size="sm" online={!!profile}/><span className="profile-trigger-name">{profile?.display_name || 'Guest'}</span><ChevronDown size={14}/>
        </button>
        <button className="icon-button mobile-menu" onClick={() => setMobileNav(v => !v)} aria-label="Toggle navigation"><Menu size={20}/></button>
      </div>
    </header>

    <div className={`workspace ${mobileNav ? 'nav-open' : ''}`}>
      <aside className="sidebar glass-panel">
        <div className="server-card">
          <div className="server-art"><div className="sigil">♛</div><div className="sigil-ring ring-a"/><div className="sigil-ring ring-b"/><Sparkles className="server-spark" size={16}/></div>
          <div className="server-info"><div className="server-name">The Monarch's Court <ChevronDown size={14}/></div><div className="server-subtitle"><span className="pulse-dot"/> Official Realm</div></div>
          <button className="icon-button tiny" title="Realm options" onClick={() => setShowSettings(true)}><Ellipsis size={18}/></button>
        </div>
        <div className="sidebar-scroll">
          <div className="side-label">YOUR REALM <button className="side-plus" title="Create channel" onClick={() => notify('Channel creation can be added after the database schema is deployed.')}><Plus size={14}/></button></div>
          <div className="room-list">{ROOMS.map((r, i) => <button key={r.id} className={`room-link ${activeRoom === r.id ? 'active' : ''}`} onClick={() => { setActiveRoom(r.id); setMobileNav(false); setSearchText('') }}>
            <span className="room-icon">{i === 3 ? <Bell size={16}/> : <Hash size={17}/>}</span><span className="room-name">{r.name}</span>{r.id === 'announcements' && <span className="room-lock"><LockKeyhole size={12}/></span>}
            {activeRoom !== r.id && i === 0 && <span className="room-unread"/>}
          </button>)}</div>
          <div className="side-label members-label">THE GUILD <span className="member-count">{onlineUsers}</span></div>
          <div className="member-row"><Avatar profile={{ display_name: 'Shadow Monarch', avatar_effect: 'royal' }} size="sm" online/><span><strong>Shadow Monarch</strong><small>In the shadows</small></span><span className="role-mini owner-mini">♛</span></div>
          <div className="member-row"><Avatar profile={{ display_name: 'Arise', avatar_effect: 'aura' }} size="sm" online/><span><strong>Arise</strong><small>Exploring dungeons</small></span><span className="member-status"/></div>
          <div className="member-row"><Avatar profile={{ display_name: 'VoidWalker', avatar_effect: 'ember' }} size="sm" online/><span><strong>VoidWalker</strong><small>Farming XP</small></span></div>
          <div className="member-row"><Avatar profile={{ display_name: 'Luna', avatar_effect: 'ice' }} size="sm"/><span><strong>Luna</strong><small>Offline</small></span></div>
          <button className="view-members" onClick={() => notify('Guild directory is coming with member search.')}>View all members <ArrowDown size={13}/></button>
          <div className="side-promo"><div className="promo-orb"><Zap size={19}/></div><strong>AWAKEN YOUR POWER</strong><p>Your legend begins with a single message.</p><div className="promo-progress"><i/></div><small>REALM EXPANSION <span>68%</span></small></div>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-user" onClick={() => profile ? setShowProfile(true) : document.getElementById('username-field')?.focus()}>
            <Avatar profile={profile} size="md" online={!!profile}/><span className="sidebar-user-copy"><strong>{profile?.display_name || 'Unawakened'}</strong><small>{profile?.role === 'owner' ? '♛ Realm Owner' : profile?.role === 'moderator' ? '✦ Moderator' : profile ? '✧ Member' : 'Guest preview'}</small></span><Settings size={16} className="settings-gear"/>
          </button>
          <div className="user-quick-actions"><button onClick={() => setShowSettings(true)} title="Settings"><Settings size={15}/></button><button onClick={() => notify('You have no new notifications.')} title="Notifications"><Bell size={15}/></button><button onClick={signOut} title="Sign out"><LogOut size={15}/></button></div>
        </div>
      </aside>

      <section className="chat-panel glass-panel">
        <div className="channel-header">
          <div className="channel-title-group"><div className="channel-symbol"><Hash size={20}/></div><div><h1>{room.name}<span className="channel-title-glow">.</span></h1><p>{room.description} <span className="header-dot"/> A place for hunters to gather</p></div></div>
          <div className="channel-tools"><div className="online-pill"><span className="pulse-dot"/>{onlineUsers} online</div><button className="icon-button" title="Search in channel" onClick={() => setShowSearch(v => !v)}><Search size={18}/></button><button className="icon-button" title="Pinned messages" onClick={() => notify(pinnedMessages.length ? `${pinnedMessages.length} pinned message(s)` : 'No pinned messages yet.')}><Pin size={18}/></button><button className="icon-button" title="Member list" onClick={() => notify('Member list is visible in the left sidebar.')}><Users size={18}/></button><button className="icon-button more-channel" title="Channel options" onClick={() => setShowSettings(true)}><MoreHorizontal size={19}/></button></div>
        </div>

        <div className="hero-banner">
          <div className="banner-art"><div className="banner-moon"/><div className="banner-rune rune-one">ᛟ</div><div className="banner-rune rune-two">ᚷ</div><div className="banner-rune rune-three">✧</div><div className="banner-horizon"/></div>
          <div className="hero-copy"><div className="hero-kicker"><span/> GUILD TRANSMISSION <span/></div><h2>Rise from the <em>shadows.</em></h2><p>Power is not given. It is awakened.</p><button className="hero-cta" onClick={() => { setDraft('The shadows answer the call. ⚔️'); document.getElementById('message-input')?.focus() }}>Send a transmission <span>↗</span></button></div>
          <div className="banner-stats"><div><strong>01</strong><span>THE AWAKENING</span></div><div><strong>∞</strong><span>YOUR POTENTIAL</span></div></div>
          <div className="banner-scanline"/>
        </div>

        {showSearch && <div className="search-bar"><Search size={16}/><input autoFocus placeholder="Search messages in this channel..." value={searchText} onChange={e => setSearchText(e.target.value)}/>{searchText && <button onClick={() => setSearchText('')}><X size={15}/></button>}<button onClick={() => setShowSearch(false)}><X size={16}/></button></div>}
        {pinnedMessages.length > 0 && <button className="pinned-strip" onClick={() => notify(pinnedMessages.map(m => m.content).join(' · '))}><Pin size={14}/> {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}<ChevronDown size={13}/></button>}

        <div className={`messages-scroll ${compactMode ? 'messages-compact' : ''}`} ref={scrollRef}>
          <div className="day-divider"><span/><div><Sparkles size={12}/> THE CHRONICLES BEGIN</div><span/></div>
          {filteredMessages.length === 0 ? <div className="empty-state"><div className="empty-emblem"><MessageCircle size={28}/></div><h3>{searchText ? 'No messages found' : 'A quiet realm… for now.'}</h3><p>{searchText ? 'Try another search term.' : 'Be the first to leave your mark on these chronicles.'}</p></div> : filteredMessages.map((m, index) => {
            const own = m.user_id === profile?.id
            const p: Partial<Profile> = m.profile || { display_name: 'Unknown Monarch', username: 'unknown', avatar_effect: 'aura' }
            const grouped = index > 0 && filteredMessages[index - 1].user_id === m.user_id && Date.now() - new Date(filteredMessages[index - 1].created_at).getTime() < 5 * 60 * 1000
            const isSticker = m.content.startsWith('[[sticker:')
            const stickerEmoji = isSticker ? m.content.slice(10, -2) : ''
            return <article className={`message-row ${own ? 'own-message' : ''} ${grouped ? 'message-grouped' : ''}`} key={m.id}>
              {!grouped && <Avatar profile={p} size="md"/>}
              {grouped && <div className="message-gutter-time">{formatTime(m.created_at)}</div>}
              <div className="message-main">
                {!grouped && <div className="message-meta"><strong className={`message-author ${p.role === 'owner' ? 'author-owner' : p.role === 'moderator' ? 'author-mod' : ''}`}>{p.display_name || p.username}</strong>{p.role === 'owner' && <span className="role-badge royal"><Crown size={10}/> MONARCH</span>}{p.role === 'moderator' && <span className="role-badge mod"><Shield size={10}/> MOD</span>}<time>{formatTime(m.created_at)}</time>{m.edited_at && <span className="edited-label">(edited)</span>}</div>}
                {isSticker ? <div className="big-sticker">{stickerEmoji}</div> : <div className={`message-bubble ${m.content.startsWith('📢 EMPIRE ANNOUNCEMENT:') ? 'announcement-bubble' : ''}`}>
                  {m.content.startsWith('📢 EMPIRE ANNOUNCEMENT:') && <span className="announcement-label"><Bell size={12}/> OFFICIAL TRANSMISSION</span>}
                  {m.content.split('\n').map((line, i) => <span key={i}>{line}{i < m.content.split('\n').length - 1 && <br/>}</span>)}
                </div>}
                {m.reactions && Object.keys(m.reactions).length > 0 && <div className="reactions-row">{Object.entries(m.reactions).map(([emoji, users]) => <button key={emoji} className="reaction-chip" onClick={() => void reactToMessage(m, emoji)}>{emoji}<span>{users.length}</span></button>)}</div>}
              </div>
              <div className="message-actions">
                <button title="React" onClick={() => { setMessageMenu(messageMenu === `react-${m.id}` ? null : `react-${m.id}`) }}><Smile size={15}/></button>
                <button title="Reply" onClick={() => { setReplyTo(m); document.getElementById('message-input')?.focus() }}><MessageCircle size={15}/></button>
                <button title="More actions" onClick={() => setMessageMenu(messageMenu === m.id ? null : m.id)}><Ellipsis size={16}/></button>
                {messageMenu === `react-${m.id}` && <div className="message-popover reaction-popover">{EMOJIS.slice(0, 10).map(em => <button key={em} onClick={() => void reactToMessage(m, em)}>{em}</button>)}</div>}
                {messageMenu === m.id && <div className="message-popover action-popover">
                  <button onClick={() => { setReplyTo(m); setMessageMenu(null); document.getElementById('message-input')?.focus() }}><MessageCircle size={14}/> Reply</button>
                  <button onClick={() => { void navigator.clipboard?.writeText(m.content); notify('Message copied.'); setMessageMenu(null) }}><Check size={14}/> Copy text</button>
                  <button onClick={() => { setPinnedIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]); setMessageMenu(null); notify('Pin state updated.') }}><Pin size={14}/> {pinnedIds.includes(m.id) ? 'Unpin message' : 'Pin message'}</button>
                  {own && <button onClick={() => { setEditingMessage(m.id); setDraft(m.content); setMessageMenu(null); document.getElementById('message-input')?.focus() }}><Settings size={14}/> Edit message</button>}
                  {!own && <button onClick={() => { setReports(prev => [...prev, m.id]); setMessageMenu(null); notify('Report noted in this session. Configure a secure reports table for persistent moderation.') }}><ShieldAlert size={14}/> Report</button>}
                  {(own || canModerate) && <button className="danger-action" onClick={() => void deleteMessage(m)}><Trash2 size={14}/> Delete message</button>}
                </div>}
              </div>
            </article>
          })}
          {connectionStatus === 'demo' && <div className="demo-note"><Sparkles size={13}/> Preview mode — connect your own Supabase project for shared real-time messages.</div>}
        </div>

        <div className="composer-wrap">
          {replyTo && <div className="reply-context"><MessageCircle size={14}/><span>Replying to <strong>{replyTo.profile?.display_name || 'Monarch'}</strong>: {replyTo.content.slice(0, 80)}</span><button onClick={() => setReplyTo(null)}><X size={14}/></button></div>}
          {editingMessage && <div className="reply-context editing-context"><Settings size={14}/><span>Editing message</span><button onClick={() => { setEditingMessage(null); setDraft('') }}><X size={14}/></button></div>}
          {showEmoji && <div className="emoji-tray glass-panel">{EMOJIS.map(em => <button key={em} onClick={() => setDraft(v => v + em)}>{em}</button>)}</div>}
          {showStickers && <div className="sticker-tray glass-panel"><div className="tray-title">EMPIRE STICKERS <span>Tap to send</span></div><div className="sticker-grid">{STICKERS.map(s => <button key={s.label} onClick={() => void sendMessage(`[[sticker:${s.emoji}]]`)}><span>{s.emoji}</span><small>{s.label}</small></button>)}</div></div>}
          <form className="composer" onSubmit={onSubmit}>
            <button type="button" className="composer-tool" title="Attach image" onClick={() => fileRef.current?.click()}><ImagePlus size={19}/></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void handleImage(e.target.files?.[0])}/>
            <button type="button" className={`composer-tool ${showStickers ? 'tool-active' : ''}`} title="Stickers" onClick={() => { setShowStickers(v => !v); setShowEmoji(false) }}><Sticker size={19}/></button>
            <div className="composer-input-wrap"><input id="message-input" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onComposerKey} placeholder={profile ? `Message #${room.name}…  (type /help for commands)` : 'Enter the realm to send a message…'} maxLength={2000} disabled={!profile}/><span className="composer-shortcut">↵</span></div>
            <button type="button" className={`composer-tool ${showEmoji ? 'tool-active' : ''}`} title="Emoji" onClick={() => { setShowEmoji(v => !v); setShowStickers(false) }}><Smile size={19}/></button>
            <button type="submit" className="send-button" disabled={!profile || !draft.trim() || sending} title="Send message">{sending ? <span className="send-spinner"/> : <Send size={17}/>}</button>
          </form>
          <div className="composer-footer"><span><LockKeyhole size={11}/> Your messages are part of the chronicles.</span><span>{draft.length}/2000</span></div>
        </div>
      </section>

      <aside className="rightbar glass-panel">
        <div className="rightbar-heading"><span>REALM INSIGHTS</span><button className="icon-button tiny" onClick={() => notify('Insights refresh automatically when connected.')}><Activity size={16}/></button></div>
        <div className="realm-status-card"><div className="status-card-top"><span className="status-live"><i/> LIVE</span><span className="status-wave"><i/><i/><i/><i/><i/></span></div><div className="status-number">{onlineUsers}<span> / 99</span></div><p>Hunters in the realm</p><div className="status-meter"><i style={{ width: `${Math.min(100, onlineUsers / 99 * 100)}%` }}/></div><div className="status-card-foot"><span><span className="pulse-dot"/> Realm stable</span><span>LATENCY —</span></div></div>
        <div className="right-section"><div className="right-section-title">THE DAILY QUEST <span>01 / 03</span></div><div className="quest-card"><div className="quest-icon"><Zap size={17}/></div><div className="quest-copy"><strong>Break the silence</strong><p>Send a message to your guild.</p></div><span className="quest-xp">+50 XP</span><div className="quest-progress"><i style={{ width: profile ? '100%' : '20%' }}/></div></div><div className="quest-card"><div className="quest-icon blue"><Users size={17}/></div><div className="quest-copy"><strong>Gather your party</strong><p>Invite fellow hunters.</p></div><span className="quest-xp">+100 XP</span><div className="quest-progress"><i style={{ width: '12%' }}/></div></div></div>
        <div className="right-section activity-section"><div className="right-section-title">RECENT ACTIVITY <span className="activity-live"><i/> LIVE</span></div><div className="activity-item"><div className="activity-icon purple"><Crown size={14}/></div><div><strong>Realm awakened</strong><p>The Monarch's Court is online.</p><small>JUST NOW</small></div></div><div className="activity-item"><div className="activity-icon blue"><Sparkles size={14}/></div><div><strong>Shadow energy detected</strong><p>A new conversation is waiting.</p><small>2 MIN AGO</small></div></div><div className="activity-item"><div className="activity-icon gold"><Shield size={14}/></div><div><strong>Keep the peace</strong><p>Respect every hunter.</p><small>ALWAYS</small></div></div></div>
        <div className="right-quote"><span>“</span><p>Arise.</p><small>THE SHADOW MONARCH</small><div className="quote-line"/></div>
        <div className="rightbar-bottom"><span>MONARCHS EMPIRE</span><span>BUILD 01.0.0</span></div>
      </aside>
    </div>

    {!profile && <Modal title="Enter the Empire" subtitle="Create your identity and awaken your profile." onClose={() => setProfile(null)}>
      <form className="entry-form" onSubmit={enterRealm}>
        <div className="entry-emblem"><Crown size={27}/><span/></div>
        <label>DISPLAY NAME<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name in the realm" maxLength={28}/></label>
        <label>USERNAME<input id="username-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ShadowHunter" maxLength={20} required/></label>
        <div className="entry-note"><Shield size={14}/><span>{supabaseConfigured ? 'Sign-in uses Supabase anonymous authentication. Your role starts as member.' : 'Preview mode: messages stay in this browser session until you connect Supabase.'}</span></div>
        <button className="primary-button" type="submit"><Sparkles size={16}/> AWAKEN MY PROFILE <span>↗</span></button>
      </form>
    </Modal>}

    {showProfile && profile && <Modal title="Your profile" subtitle="Customize your presence in the realm." onClose={() => setShowProfile(false)}>
      <div className="profile-banner-preview" style={bannerUrl ? { backgroundImage: `linear-gradient(90deg, #0a0916aa, #0a091655), url("${bannerUrl}")` } : {}}><div className="banner-preview-glow"/><Avatar profile={{ ...profile, avatar_url: avatarUrl || profile.avatar_url, avatar_effect: avatarEffect }} size="lg"/></div>
      <div className="profile-edit-form">
        <label>DISPLAY NAME<input value={displayName || profile.display_name} onChange={e => setDisplayName(e.target.value)} maxLength={28}/></label>
        <label>STATUS<input value={statusText} onChange={e => setStatusText(e.target.value)} maxLength={60} placeholder="What are you up to?"/></label>
        <label>AVATAR IMAGE URL<input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://… (optional)"/></label>
        <label>BANNER IMAGE URL<input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://… (optional)"/></label>
        <label>AVATAR AURA<div className="effect-picker">{['aura','royal','ember','ice','none'].map(effect => <button type="button" key={effect} className={avatarEffect === effect ? 'selected' : ''} onClick={() => setAvatarEffect(effect)}><Avatar profile={{ display_name: profile.display_name, avatar_effect: effect }} size="sm"/><span>{effect}</span></button>)}</div></label>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setShowProfile(false)}>Cancel</button><button className="primary-button" onClick={() => void updateProfile()}><Check size={15}/> Save profile</button></div>
      </div>
    </Modal>}

    {showSettings && <Modal title="Realm settings" subtitle="Tune your experience." onClose={() => setShowSettings(false)}>
      <div className="settings-list">
        <div className="settings-row"><div><strong>Violet shadow theme</strong><small>Switch between violet and blue accents.</small></div><button className={`toggle ${darkPurple ? 'on' : ''}`} onClick={() => setDarkPurple(v => !v)}><i/></button></div>
        <div className="settings-row"><div><strong>Compact messages</strong><small>Fit more messages on screen.</small></div><button className={`toggle ${compactMode ? 'on' : ''}`} onClick={() => setCompactMode(v => !v)}><i/></button></div>
        <div className="settings-row"><div><strong>Reduce motion</strong><small>Reduce decorative movement.</small></div><button className={`toggle ${reducedMotion ? 'on' : ''}`} onClick={() => setReducedMotion(v => !v)}><i/></button></div>
        <button className="settings-action" onClick={() => { setShowSettings(false); setShowProfile(true) }}><AtSign size={16}/> Edit profile <span>›</span></button>
        <button className="settings-action" onClick={() => { setShowSettings(false); setShowModeration(true) }}><Shield size={16}/> Moderation panel <span>›</span></button>
        <button className="settings-action danger-action" onClick={() => { setShowSettings(false); setShowConfirmClear(true) }}><Trash2 size={16}/> Clear current chat <span>›</span></button>
        <div className="settings-foot"><LockKeyhole size={13}/> Changes to appearance are saved in this session.</div>
      </div>
    </Modal>}

    {showModeration && <Modal title="Monarch console" subtitle="Moderation tools and realm controls." onClose={() => setShowModeration(false)}>
      <div className="mod-console-banner"><div><ShieldAlert size={21}/></div><section><strong>{isOwner ? 'Owner access' : canModerate ? 'Moderator access' : 'Read-only preview'}</strong><p>{canModerate ? 'You can moderate messages using their action menus.' : 'Role assignment is protected. The owner role must be granted securely in Supabase by a trusted administrator.'}</p></section></div>
      <div className="mod-stats"><div><strong>{reports.length}</strong><span>SESSION REPORTS</span></div><div><strong>{messages.filter(m => !m.id.startsWith('demo-')).length}</strong><span>VISIBLE MESSAGES</span></div><div><strong>{pinnedIds.length}</strong><span>PINNED ITEMS</span></div></div>
      <div className="settings-list"><button className="settings-action" onClick={() => { setShowModeration(false); notify('/announce message — send an official announcement in the current channel.') }}><Bell size={16}/> Announcement command <span>›</span></button><button className="settings-action" onClick={() => { setShowModeration(false); setShowConfirmClear(true) }}><Trash2 size={16}/> Clear room messages <span>›</span></button><div className="settings-foot"><LockKeyhole size={13}/> This starter UI does not let users grant themselves moderator or owner privileges.</div></div>
    </Modal>}

    {showConfirmClear && <Modal title="Clear this channel?" subtitle="This action cannot be undone from this screen." onClose={() => setShowConfirmClear(false)}>
      <div className="clear-warning"><Trash2 size={22}/><p>{isOwner && supabaseConfigured ? 'As owner, this will mark all messages in this room as deleted for everyone.' : 'This clears messages from your current view. It does not delete other members’ messages from the database.'}</p></div>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setShowConfirmClear(false)}>Cancel</button><button className="primary-button danger-button" onClick={() => void clearChat()}><Trash2 size={15}/> Clear chat</button></div>
    </Modal>}

    {toast && <div className="toast glass-panel"><span className="toast-icon"><Check size={15}/></span>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
    <footer className="mobile-footer"><span><Crown size={13}/> MONARCHS EMPIRE</span><span>{connectionStatus === 'live' ? 'LIVE' : 'PREVIEW'}</span></footer>
  </main>
                                                                                                                            }
