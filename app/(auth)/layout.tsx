export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ backgroundColor: '#f0faf4' }}>
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold" style={{ color: '#0a4d2a' }}>
                        SafeVoice
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#5a6270' }}>
                        Safe reporting for everyone
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-8"
                    style={{ borderColor: '#d1d5db' }}>
                    {children}
                </div>
            </div>
        </div>
    )
}