'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Document as DocType, Chatbot } from '@/lib/types';
import DocumentUpload from './DocumentUpload';
import {
    FileText, Trash2, Database, Clock, Code2, Copy,
    Check, Settings as SettingsIcon, FileSpreadsheet, File,
    Globe, MessageCircle, Send as SendIcon, RefreshCw, Plus,
    Link, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GoogleSheet {
    id: string;
    chatbot_id: string;
    sheet_url: string;
    sheet_name: string;
    status: string;
    last_synced_at: string | null;
    sync_interval_minutes: number;
    created_at: string;
}

interface SettingsPanelProps {
    chatbot: Chatbot;
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsPanel({
    chatbot,
    isOpen,
    onClose,
}: SettingsPanelProps) {
    const [documents, setDocuments] = useState<DocType[]>([]);
    const [embeddingCount, setEmbeddingCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'documents' | 'embed' | 'integrations'>('documents');
    const [copied, setCopied] = useState(false);

    // Google Sheets state
    const [sheets, setSheets] = useState<GoogleSheet[]>([]);
    const [sheetUrl, setSheetUrl] = useState('');
    const [sheetName, setSheetName] = useState('');
    const [addingSheet, setAddingSheet] = useState(false);
    const [syncingSheetId, setSyncingSheetId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && chatbot.id) {
            loadDocuments();
            loadEmbeddingCount();
            loadGoogleSheets();
        }
    }, [isOpen, chatbot.id]);

    const loadDocuments = async () => {
        try {
            const docs = await api.getDocuments(chatbot.id);
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    };

    const loadEmbeddingCount = async () => {
        try {
            const result = await api.getEmbeddingCount(chatbot.id);
            setEmbeddingCount(result.count);
        } catch (error) {
            console.error('Failed to get embedding count:', error);
        }
    };

    const loadGoogleSheets = async () => {
        try {
            const result = await api.getGoogleSheets(chatbot.id);
            setSheets(result);
        } catch (error) {
            console.error('Failed to load Google Sheets:', error);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm('Delete this document and all its embeddings?')) return;
        try {
            await api.deleteDocument(chatbot.id, docId);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
            loadEmbeddingCount();
            toast.success('Document deleted');
        } catch (error) {
            toast.error('Failed to delete document');
        }
    };

    const handleAddSheet = async () => {
        if (!sheetUrl.trim()) {
            toast.error('Please enter a Google Sheet URL');
            return;
        }
        setAddingSheet(true);
        try {
            await api.addGoogleSheet(chatbot.id, sheetUrl, sheetName || 'Google Sheet');
            toast.success('Google Sheet connected and data synced!');
            setSheetUrl('');
            setSheetName('');
            loadGoogleSheets();
            loadEmbeddingCount();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add Google Sheet');
        } finally {
            setAddingSheet(false);
        }
    };

    const handleSyncSheet = async (sheetId: string) => {
        setSyncingSheetId(sheetId);
        try {
            await api.syncGoogleSheet(chatbot.id, sheetId);
            toast.success('Sheet synced successfully!');
            loadGoogleSheets();
            loadEmbeddingCount();
        } catch (error: any) {
            toast.error(error.message || 'Sync failed');
        } finally {
            setSyncingSheetId(null);
        }
    };

    const handleDeleteSheet = async (sheetId: string) => {
        if (!confirm('Disconnect this Google Sheet and remove its data?')) return;
        try {
            await api.deleteGoogleSheet(chatbot.id, sheetId);
            setSheets((prev) => prev.filter((s) => s.id !== sheetId));
            loadEmbeddingCount();
            toast.success('Google Sheet disconnected');
        } catch (error) {
            toast.error('Failed to disconnect Google Sheet');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (type: string) => {
        if (type === 'xlsx' || type === 'csv') return <FileSpreadsheet className="w-4 h-4" />;
        if (type === 'pdf' || type === 'docx') return <FileText className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const d = new Date(dateStr);
        return d.toLocaleString();
    };

    const embedCode = `<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/widget.js" data-bot-id="${chatbot.id}"></script>`;

    const copyEmbedCode = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        toast.success('Embed code copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-dark-900 border-l border-dark-800 z-50 flex flex-col animate-slide-in-left shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
                <div className="flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-dark-400" />
                    <h3 className="text-sm font-semibold text-white">Settings</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-800 hover:text-dark-200 transition-all"
                >
                    ✕
                </button>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 px-6 py-3 bg-dark-800/30 border-b border-dark-800">
                <div className="flex items-center gap-1.5 text-xs text-dark-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{documents.length} docs</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-dark-400">
                    <Database className="w-3.5 h-3.5" />
                    <span>{embeddingCount} embeddings</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-dark-400">
                    <Link className="w-3.5 h-3.5" />
                    <span>{sheets.length} sheets</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-dark-800">
                {[
                    { key: 'documents', label: 'Documents', icon: FileText },
                    { key: 'embed', label: 'Embed', icon: Code2 },
                    { key: 'integrations', label: 'Connect', icon: Globe },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-all
              ${activeTab === tab.key
                                ? 'text-brand-400 border-b-2 border-brand-500'
                                : 'text-dark-500 hover:text-dark-300'
                            }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Documents Tab */}
                {activeTab === 'documents' && (
                    <div className="space-y-6">
                        <DocumentUpload
                            chatbotId={chatbot.id}
                            onUploadComplete={() => {
                                loadDocuments();
                                loadEmbeddingCount();
                            }}
                        />

                        {/* Document List */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                                Uploaded Documents
                            </h4>
                            {documents.length === 0 ? (
                                <p className="text-sm text-dark-500 py-4 text-center">
                                    No documents uploaded yet
                                </p>
                            ) : (
                                documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 border border-dark-700 group"
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${doc.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400'
                                                : doc.status === 'error' ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-dark-700 text-dark-400'
                                            }`}
                                        >
                                            {getFileIcon(doc.file_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-dark-200 truncate">{doc.filename}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-dark-500">{formatFileSize(doc.file_size)}</span>
                                                <span className="text-xs text-dark-500">{doc.chunk_count} chunks</span>
                                                <span className={`text-xs ${doc.status === 'ready' ? 'text-emerald-400'
                                                    : doc.status === 'error' ? 'text-red-400'
                                                        : 'text-amber-400'
                                                    }`}>
                                                    {doc.status}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-1.5 rounded-lg text-dark-600 opacity-0 group-hover:opacity-100
                                 hover:bg-red-500/10 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Google Sheets Section */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center">
                                    <FileSpreadsheet className="w-3 h-3 text-green-400" />
                                </div>
                                <h4 className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                                    Google Sheets
                                </h4>
                            </div>

                            {/* Add Sheet Form */}
                            <div className="p-4 rounded-xl bg-dark-800/30 border border-dark-700 space-y-3">
                                <input
                                    type="text"
                                    value={sheetUrl}
                                    onChange={(e) => setSheetUrl(e.target.value)}
                                    placeholder="Paste Google Sheet URL..."
                                    className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-brand-500/50 transition-colors"
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={sheetName}
                                        onChange={(e) => setSheetName(e.target.value)}
                                        placeholder="Sheet name (optional)"
                                        className="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-brand-500/50 transition-colors"
                                    />
                                    <button
                                        onClick={handleAddSheet}
                                        disabled={addingSheet || !sheetUrl.trim()}
                                        className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium
                                            hover:bg-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                            flex items-center gap-1.5 border border-green-500/20"
                                    >
                                        {addingSheet ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Plus className="w-3.5 h-3.5" />
                                        )}
                                        {addingSheet ? 'Syncing...' : 'Connect'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-dark-500 leading-relaxed">
                                    ⓘ Make sure the sheet is shared as &quot;Anyone with the link can view&quot;. Data auto-syncs every 5 minutes.
                                </p>
                            </div>

                            {/* Connected Sheets List */}
                            {sheets.map((sheet) => (
                                <div
                                    key={sheet.id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 border border-dark-700 group"
                                >
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                                        ${sheet.status === 'ready' ? 'bg-green-500/10 text-green-400'
                                            : sheet.status === 'error' ? 'bg-red-500/10 text-red-400'
                                                : 'bg-amber-500/10 text-amber-400'
                                        }`}
                                    >
                                        <FileSpreadsheet className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-dark-200 truncate">{sheet.sheet_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-xs ${sheet.status === 'ready' ? 'text-emerald-400'
                                                : sheet.status === 'error' ? 'text-red-400' : 'text-amber-400'
                                                }`}>
                                                {sheet.status}
                                            </span>
                                            <span className="text-[10px] text-dark-600">•</span>
                                            <span className="text-[10px] text-dark-500 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {formatTime(sheet.last_synced_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => handleSyncSheet(sheet.id)}
                                            disabled={syncingSheetId === sheet.id}
                                            className="p-1.5 rounded-lg text-dark-500 hover:bg-brand-500/10 hover:text-brand-400 transition-all"
                                            title="Sync now"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${syncingSheetId === sheet.id ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSheet(sheet.id)}
                                            className="p-1.5 rounded-lg text-dark-600 hover:bg-red-500/10 hover:text-red-400 transition-all"
                                            title="Disconnect"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Embed Tab */}
                {activeTab === 'embed' && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold text-white mb-2">Embed Widget</h4>
                            <p className="text-xs text-dark-400 mb-4">
                                Add this script tag to your website to embed the chat widget.
                            </p>

                            <div className="relative">
                                <pre className="bg-dark-800 border border-dark-700 rounded-xl p-4 text-xs text-dark-300 overflow-x-auto">
                                    <code>{embedCode}</code>
                                </pre>
                                <button
                                    onClick={copyEmbedCode}
                                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-dark-700 text-dark-400 hover:text-dark-200 transition-all"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                            <div className="flex items-start gap-3">
                                <Globe className="w-5 h-5 text-brand-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-brand-300 font-medium">How it works</p>
                                    <p className="text-xs text-dark-400 mt-1 leading-relaxed">
                                        The widget creates a floating chat bubble on your website. Visitors can click it
                                        to chat with your AI bot. No authentication required for widget users.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Integrations Tab */}
                {activeTab === 'integrations' && (
                    <div className="space-y-4">
                        {/* WhatsApp */}
                        <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                                    <MessageCircle className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white">WhatsApp</h4>
                                    <p className="text-xs text-dark-500">Business Cloud API</p>
                                </div>
                            </div>
                            <p className="text-xs text-dark-400 leading-relaxed mb-3">
                                Connect your WhatsApp Business account to receive and respond to messages
                                through your AI chatbot.
                            </p>
                            <div className="text-xs text-dark-500 bg-dark-800 rounded-lg p-3 font-mono">
                                Webhook URL: /api/webhooks/whatsapp
                            </div>
                        </div>

                        {/* Telegram */}
                        <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                    <SendIcon className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white">Telegram</h4>
                                    <p className="text-xs text-dark-500">Bot API</p>
                                </div>
                            </div>
                            <p className="text-xs text-dark-400 leading-relaxed mb-3">
                                Create a Telegram bot via @BotFather and connect it to route messages
                                through your RAG pipeline.
                            </p>
                            <div className="text-xs text-dark-500 bg-dark-800 rounded-lg p-3 font-mono">
                                Webhook URL: /api/webhooks/telegram/{'<bot_token>'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
