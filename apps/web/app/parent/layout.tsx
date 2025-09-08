export default function ParentLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0f2a)' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                borderBottom: '1px solid var(--border, #1f2547)',
                background: 'rgba(14,18,43,0.85)', backdropFilter: 'saturate(0.9) blur(8px)',
                WebkitBackdropFilter: 'saturate(0.9) blur(8px)'
            }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, letterSpacing: '-0.01em' }}>Parent Portal</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>Read-only • Live data</div>
                </div>
            </div>
            {children}
        </div>
    );
}