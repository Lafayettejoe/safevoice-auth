'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Note {
    publicId: string
    title: string
    content: string
    createdAt: string
    updatedAt: string
}

function RecordsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const view = searchParams.get('view')
    const publicId = searchParams.get('id')

    const [notes, setNotes] = useState<Note[]>([])
    const [selectedNote, setSelectedNote] = useState<Note | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Create form state
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

    // Delete state
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Fetch all notes
    async function fetchNotes() {
        try {
            const res = await fetch('/api/records')
            const data = await res.json()
            if (res.ok) setNotes(data.notes || [])
        } catch {
            setError('Failed to load records')
        } finally {
            setLoading(false)
        }
    }

    // Fetch single note when URL changes
    async function fetchNote(id: string) {
        try {
            const res = await fetch(`/api/records/${id}`)
            if (res.status === 401) {
                router.push('/signin')
                return
            }
            if (res.status === 403) {
                setError('You do not have permission to view this record')
                return
            }
            if (res.status === 404) {
                setError('Record not found')
                return
            }
            const data = await res.json()
            if (res.ok) setSelectedNote(data.note)
        } catch {
            setError('Failed to load record')
        }
    }

    useEffect(() => {
        fetchNotes()
    }, [])

    useEffect(() => {
        if (view === 'detail' && publicId) {
            fetchNote(publicId)
        } else {
            setSelectedNote(null)
        }
    }, [view, publicId])

    function setView(newView: string, id?: string) {
        const params = new URLSearchParams()
        params.set('view', newView)
        if (id) params.set('id', id)
        router.push(`/records?${params.toString()}`)
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setCreateError('')

        if (!title.trim()) { setCreateError('Title is required'); return }
        if (!content.trim()) { setCreateError('Content is required'); return }

        setCreating(true)
        try {
            const res = await fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            })

            const data = await res.json()

            if (!res.ok) {
                setCreateError(data.error || 'Failed to create record')
                return
            }

            setTitle('')
            setContent('')
            await fetchNotes()
            router.push('/records?view=list')

        } catch {
            setCreateError('Something went wrong')
        } finally {
            setCreating(false)
        }
    }

    async function handleDelete() {
        if (!selectedNote) return

        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/records/${selectedNote.publicId}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Delete failed')
                return
            }

            setShowDeleteConfirm(false)
            await fetchNotes()
            router.push('/records?view=list')

        } catch {
            setError('Something went wrong')
        } finally {
            setDeleteLoading(false)
        }
    }

    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        backgroundColor: '#f0faf4',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }

    const navStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2f0e8',
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    }

    const cardStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
        border: '1px solid #e2f0e8',
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        color: '#16181c',
        backgroundColor: '#ffffff',
        outline: 'none',
        boxSizing: 'border-box',
    }

    const primaryBtn: React.CSSProperties = {
        padding: '9px 20px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#0a4d2a',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
    }

    const secondaryBtn: React.CSSProperties = {
        padding: '9px 20px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        backgroundColor: '#ffffff',
        color: '#374151',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
    }

    return (
        <div style={containerStyle}>
            {/* Nav */}
            <div style={navStyle}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>
                    SafeVoice
                </span>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button onClick={() => setView('create')} style={primaryBtn}>
                        New record
                    </button>
                    <a href="/dashboard" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, textDecoration: 'none' }}>
                        ← Dashboard
                    </a>
                </div>
            </div>

            <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px' }}>

                {error && (
                    <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                        {error}
                        <button onClick={() => setError('')} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#8b1a1a', fontWeight: 600 }}>
                            ✕
                        </button>
                    </div>
                )}

                {/* CREATE VIEW */}
                {view === 'create' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#16181c', margin: 0 }}>
                                New case note
                            </h1>
                            <button onClick={() => router.push('/records?view=list')} style={secondaryBtn}>
                                Cancel
                            </button>
                        </div>

                        {createError && (
                            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreate} noValidate>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="title" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16181c', marginBottom: '6px' }}>
                                    Title
                                </label>
                                <input
                                    id="title"
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Initial assessment — Camp B"
                                    style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#0a4d2a'}
                                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label htmlFor="content" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16181c', marginBottom: '6px' }}>
                                    Content
                                </label>
                                <textarea
                                    id="content"
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Write your case note here..."
                                    rows={8}
                                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                                    onFocus={e => e.target.style.borderColor = '#0a4d2a'}
                                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={creating}
                                style={{ ...primaryBtn, opacity: creating ? 0.7 : 1, width: '100%', padding: '11px 0' }}
                            >
                                {creating ? 'Saving...' : 'Save case note'}
                            </button>
                        </form>
                    </div>
                )}

                {/* DETAIL VIEW */}
                {view === 'detail' && selectedNote && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div>
                                <button
                                    onClick={() => router.push('/records?view=list')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a7a44', fontSize: '13px', fontWeight: 500, padding: 0, marginBottom: '8px', display: 'block' }}
                                >
                                    ← Back to records
                                </button>
                                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#16181c', margin: 0 }}>
                                    {selectedNote.title}
                                </h1>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                                    Created {new Date(selectedNote.createdAt).toLocaleDateString()} ·
                                    ID: {selectedNote.publicId}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px',
                                    border: '1px solid #e57373', backgroundColor: '#ffffff',
                                    color: '#8b1a1a', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Delete
                            </button>
                        </div>

                        <div style={{
                            padding: '20px',
                            borderRadius: '10px',
                            backgroundColor: '#f9fafb',
                            border: '1px solid #f0faf4',
                            fontSize: '14px',
                            color: '#16181c',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                        }}>
                            {selectedNote.content}
                        </div>
                    </div>
                )}

                {/* LIST VIEW — default */}
                {(!view || view === 'list') && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#16181c', margin: 0 }}>
                                Case notes
                            </h1>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                {notes.length} record{notes.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {loading && (
                            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
                                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Loading records...</p>
                            </div>
                        )}

                        {/* True empty state */}
                        {!loading && notes.length === 0 && (
                            <div style={{ ...cardStyle, textAlign: 'center', padding: '64px 40px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                                    No case notes yet
                                </h2>
                                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
                                    Create your first case note to get started.
                                </p>
                                <button onClick={() => setView('create')} style={primaryBtn}>
                                    Create first note
                                </button>
                            </div>
                        )}

                        {/* Notes list */}
                        {!loading && notes.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {notes.map(note => (
                                    <div
                                        key={note.publicId}
                                        onClick={() => setView('detail', note.publicId)}
                                        style={{
                                            ...cardStyle,
                                            cursor: 'pointer',
                                            padding: '20px 24px',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#0a4d2a')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2f0e8')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#16181c', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {note.title}
                                                </h3>
                                                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {note.content.slice(0, 80)}{note.content.length > 80 ? '...' : ''}
                                                </p>
                                            </div>
                                            <div style={{ marginLeft: '16px', flexShrink: 0, textAlign: 'right' }}>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#a8d5bb', margin: '2px 0 0', fontFamily: 'monospace' }}>
                                                    {note.publicId.slice(0, 8)}...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 50, padding: '24px',
                }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Delete this record?
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
                            This action cannot be undone. A deletion record will be written to the audit log before the note is removed.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{ ...secondaryBtn, flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteLoading}
                                style={{
                                    flex: 1, padding: '9px 0', borderRadius: '8px',
                                    border: 'none', backgroundColor: '#8b1a1a',
                                    color: '#ffffff', fontSize: '13px', fontWeight: 600,
                                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                                    opacity: deleteLoading ? 0.7 : 1,
                                }}
                            >
                                {deleteLoading ? 'Deleting...' : 'Yes, delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function RecordsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RecordsContent />
        </Suspense>
    )
}