'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = e.target.files?.[0]
        if (!selected) return

        const maxSize = 25 * 1024 * 1024
        if (selected.size > maxSize) {
            setError('File must be under 25MB')
            return
        }

        setError('')
        setFile(selected)
    }

    async function handleUpload() {
        if (!file) return

        setUploading(true)
        setError('')

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('fileName', file.name)
            formData.append('fileSize', file.size.toString())

            const response = await fetch('/api/ai/process', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Processing failed')
            }

            const { jobId } = await response.json()
            router.push(`/results/${jobId}`)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f0faf4',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2f0e8',
                padding: '0 32px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>SafeVoice</span>
                <a href="/dashboard" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, textDecoration: 'none' }}>
                    ← Back to dashboard
                </a>
            </div>

            <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                    Upload Voice Report
                </h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 32px' }}>
                    Upload an audio recording. SafeVoice will transcribe it and assess the risk level automatically.
                </p>

                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '40px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
                    border: '1px solid #e2f0e8',
                }}>
                    <label
                        htmlFor="audio-upload"
                        style={{
                            display: 'block',
                            border: `2px dashed ${file ? '#0a4d2a' : '#d1d5db'}`,
                            borderRadius: '12px',
                            padding: '48px 24px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: file ? '#f0faf4' : '#fafafa',
                            marginBottom: '24px',
                        }}
                    >
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                            {file ? '🎵' : '🎤'}
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#16181c', margin: '0 0 4px' }}>
                            {file ? file.name : 'Click to select an audio file'}
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            {file
                                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                                : 'MP3, WAV, WebM, M4A — maximum 25MB'}
                        </p>
                        <input
                            id="audio-upload"
                            type="file"
                            accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg,.opus,.aac"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </label>

                    {error && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: '#fde8e8',
                            color: '#8b1a1a',
                            fontSize: '13px',
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        style={{
                            width: '100%',
                            padding: '12px 0',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: !file || uploading ? '#a8d5bb' : '#0a4d2a',
                            color: '#ffffff',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: !file || uploading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {uploading ? 'Uploading and processing...' : 'Upload and analyse'}
                    </button>

                    <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', backgroundColor: '#f0faf4' }}>
                        <p style={{ fontSize: '12px', color: '#5a6270', margin: 0, lineHeight: 1.6 }}>
                            <strong style={{ color: '#0a4d2a' }}>How it works:</strong> Your audio is sent
                            securely to OpenAI Whisper for transcription, then classified by GPT-4o-mini.
                            Only a storage reference is saved in the database — never the audio file itself.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}