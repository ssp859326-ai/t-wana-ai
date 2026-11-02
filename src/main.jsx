import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, MessageCircle, Image as ImageIcon, ArrowUp, Plus, PanelLeftClose, PanelLeftOpen, Copy, Check, Download, WandSparkles, Globe2, Zap, Menu, X, ChevronDown, ImagePlus, LoaderCircle, Bot, User, Github, ExternalLink } from 'lucide-react';
import './styles.css';

const suggestions = [
  { icon: '✧', title: 'Dream up a new world', prompt: 'Imagine a beautiful futuristic world where nature and technology live in harmony.' },
  { icon: '◈', title: 'Write something brilliant', prompt: 'Help me write a compelling short story with a surprising ending.' },
  { icon: '⌘', title: 'Make an image prompt', prompt: 'Create a detailed image prompt for a cinematic, photorealistic scene.' },
  { icon: '✳', title: 'Explain it simply', prompt: 'Explain artificial intelligence in simple, friendly language.' }
];

function App() {
  const [mode, setMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [image, setImage] = useState('');
  const [referenceImage, setReferenceImage] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [strength, setStrength] = useState(0.35);
  const referenceInput = useRef(null);
  const [error, setError] = useState('');
  const [sidebar, setSidebar] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [copied, setCopied] = useState(-1);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  useEffect(() => { if (mode === 'chat') inputRef.current?.focus(); }, [mode]);

  const newChat = () => { setMessages([]); setInput(''); setError(''); setMode('chat'); setMobileMenu(false); };
  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError('');
    const next = [...messages, { role: 'user', content: clean }];
    setMessages(next); setInput(''); setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setMessages([...next, { role: 'assistant', content: data.text }]);
    } catch (e) { setError(e.message || 'Unable to connect.'); }
    finally { setBusy(false); inputRef.current?.focus(); }
  };
  const chooseReference = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Please choose an image smaller than 12 MB.'); return; }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const optimized = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 768 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(256, Math.round(img.width * scale));
          canvas.height = Math.max(256, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
      setReferenceImage(optimized);
      setReferenceName(file.name);
      setError('');
    } catch { setError('Could not read that image. Please try another file.'); }
  };
  const generate = async () => {
    if (!prompt.trim() || imageBusy) return;
    setImage(''); setError(''); setImageBusy(true);
    try {
      const res = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, image_b64: referenceImage ? referenceImage.split(',')[1] : undefined, strength }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed.');
      setImage(data.image);
    } catch (e) { setError(e.message || 'Unable to generate image.'); }
    finally { setImageBusy(false); }
  };
  const copyText = async (text, index) => {
    try { await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(-1), 1600); } catch {}
  };
  const selectMode = (m) => { setMode(m); setError(''); setMobileMenu(false); };
  const downloadImage = () => {
    if (!image) return;
    const a = document.createElement('a'); a.href = image; a.download = 't-wana-ai-creation.png'; a.click();
  };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? 'sidebar-open' : 'sidebar-closed'} ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><span className="brand-glyph">✳</span></div>
        {sidebar && <div className="brand-name">T-wana<span>AI</span></div>}
        <button className="icon-button sidebar-toggle" title="Collapse sidebar" onClick={() => setSidebar(!sidebar)}>{sidebar ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
        <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)}><X size={18}/></button>
      </div>
      <button className="new-chat-button" onClick={newChat}><Plus size={17}/>{sidebar && <span>New conversation</span>}</button>
      <div className="nav-label">{sidebar ? 'WORKSPACE' : ''}</div>
      <button className={`nav-item ${mode === 'chat' ? 'nav-active' : ''}`} onClick={() => selectMode('chat')}><MessageCircle size={18}/>{sidebar && <span>AI Chat</span>}{sidebar && <span className="nav-pill">01</span>}</button>
      <button className={`nav-item ${mode === 'image' ? 'nav-active' : ''}`} onClick={() => selectMode('image')}><ImageIcon size={18}/>{sidebar && <span>Image Studio</span>}{sidebar && <span className="nav-pill">02</span>}</button>
      {sidebar && <div className="sidebar-bottom">
        <div className="sidebar-orb"><div className="orb-core"/></div>
        <div className="sidebar-bottom-title">Ideas into reality.</div>
        <div className="sidebar-bottom-copy">A creative space for your next big thing.</div>
        <div className="sidebar-footer"><span className="online-dot"/> Systems ready <span className="version">v1.0</span></div>
      </div>}
    </aside>
    {mobileMenu && <div className="mobile-scrim" onClick={() => setMobileMenu(false)}/>}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={19}/></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{mode === 'chat' ? 'AI Chat' : 'Image Studio'}</strong></div>
        </div>
        <div className="topbar-right"><div className="language-chip"><Globe2 size={14}/> <span>Multilingual</span><ChevronDown size={13}/></div><div className="topbar-divider"/><div className="avatar">T</div></div>
      </header>

      {mode === 'chat' ? <section className={`chat-workspace ${messages.length ? 'has-messages' : ''}`}>
        {messages.length === 0 ? <div className="welcome-wrap">
          <div className="welcome-eyebrow"><span className="eyebrow-spark">✦</span> YOUR CREATIVE INTELLIGENCE <span className="eyebrow-line"/></div>
          <h1>Imagine <span className="gradient-word">beyond.</span></h1>
          <p className="welcome-subtitle">A little curiosity can change everything.<br/>What shall we create today?</p>
          <div className="suggestion-grid">{suggestions.map((s, i) => <button className="suggestion-card" key={i} onClick={() => send(s.prompt)}><div className="suggestion-icon">{s.icon}</div><div className="suggestion-title">{s.title}</div><div className="suggestion-arrow">↗</div></button>)}</div>
        </div> : <div className="conversation">
          {messages.map((m, i) => <div className={`message-row ${m.role}`} key={i}>
            <div className={`message-avatar ${m.role}`}>{m.role === 'assistant' ? <span>✳</span> : <User size={15}/>}</div>
            <div className="message-content"><div className="message-name">{m.role === 'assistant' ? 'T-wana AI' : 'You'}</div><div className="message-text">{m.content}</div>{m.role === 'assistant' && <button className="message-copy" onClick={() => copyText(m.content, i)}>{copied === i ? <Check size={13}/> : <Copy size={13}/>} {copied === i ? 'Copied' : 'Copy'}</button>}</div>
          </div>)}
          {busy && <div className="message-row assistant"><div className="message-avatar assistant"><span>✳</span></div><div className="message-content"><div className="message-name">T-wana AI</div><div className="typing"><span/><span/><span/></div></div></div>}
          <div ref={endRef}/>
        </div>}
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={14}/></button></div>}
        <div className="composer-wrap"><form className="chat-composer" onSubmit={e => { e.preventDefault(); send(); }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything. Imagine everything..." rows="1" disabled={busy}/>
          <div className="composer-footer"><div className="composer-hint"><Sparkles size={13}/><span>Replies in your language</span></div><button className="send-button" disabled={!input.trim() || busy} aria-label="Send message">{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowUp size={18}/>}</button></div>
        </form><div className="disclaimer">T-wana AI can make mistakes. Explore with curiosity.</div></div>
      </section> : <section className="image-workspace">
        <div className="image-heading"><div className="welcome-eyebrow"><span className="eyebrow-spark">✦</span> IMAGE STUDIO <span className="eyebrow-line"/></div><h1>Make it <span className="gradient-word">visual.</span></h1><p>Turn the images in your mind into something real.</p></div>
        <div className="image-layout">
          <div className="image-prompt-panel"><div className="panel-title"><WandSparkles size={16}/> <span>Describe your vision</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A cinematic landscape at sunset, dreamy atmosphere, soft light..." rows="5"/><div className="prompt-foot"><span>✧ Let your imagination lead</span><span>{prompt.length}/4000</span></div><div className="reference-upload"><input ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => chooseReference(e.target.files?.[0])}/><button type="button" className="reference-button" onClick={() => referenceInput.current?.click()}><ImagePlus size={16}/>{referenceImage ? 'Change reference image' : 'Add reference image'}</button>{referenceImage && <button type="button" className="reference-remove" onClick={() => {setReferenceImage('');setReferenceName('');}}>Remove</button>}<span className="reference-caption">{referenceImage ? referenceName : 'Use a picture to guide the result'}</span></div>{referenceImage && <div className="strength-control"><label htmlFor="reference-strength">Keep reference details</label><input id="reference-strength" type="range" min="0.15" max="0.75" step="0.05" value={strength} onChange={e => setStrength(Number(e.target.value))}/><span>{Math.round((1-strength)*100)}% likeness</span></div>}<button className="generate-button" disabled={!prompt.trim() || imageBusy} onClick={generate}>{imageBusy ? <><LoaderCircle size={17} className="spin"/> Creating your image...</> : <><Sparkles size={17}/> Generate image <ArrowUp size={15}/></>}</button><div className="image-note"><Zap size={14}/> Powered by generative AI</div></div>
          <div className="image-preview-panel">{imageBusy ? <div className="generating-state"><div className="generation-orb"><div/></div><strong>Bringing your vision to life</strong><span>Creating pixels with purpose...</span></div> : image ? <div className="image-result"><img src={image} alt={prompt}/><div className="image-result-toolbar"><span>✳ Your creation</span><button onClick={downloadImage}><Download size={15}/> Download</button></div></div> : <div className="image-empty"><div className="empty-art"><div className="art-shape shape-one"/><div className="art-shape shape-two"/><div className="art-shape shape-three"/><div className="art-spark">✦</div></div><strong>Your canvas awaits</strong><span>Your generated image will appear here.</span></div>}</div>
        </div>
        {error && <div className="error-banner image-error"><span>{error}</span><button onClick={() => setError('')}><X size={14}/></button></div>}
        <div className="image-bottom-note">Make something that feels like you. <span>✦</span></div>
      </section>}
      <footer className="main-footer"><span>© 2026 T-wana AI</span><span className="footer-center"><span className="online-dot"/> Built for imagination</span><span className="footer-credit">by <strong>pindu-tiwana</strong> · Team T-wana</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);