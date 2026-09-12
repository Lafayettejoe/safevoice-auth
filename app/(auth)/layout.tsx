export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                minHeight: '100vh',
                backgroundColor: '#f0faf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div style={{ width: '100%', maxWidth: '420px' }}>
                {children}
            </div>
        </div>
    )
}