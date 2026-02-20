'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Document as DocType, Chatbot } from '@/lib/types';
import DocumentUpload from './DocumentUpload';
import {
    FileText, Trash2, Database, Clock, Code2, Copy,
    Check, Settings as SettingsIcon, FileSpreadsheet, File,
    Globe, MessageCircle, Send as SendIcon, RefreshCw, Plus,
    Link, Loader2, Power, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

// GoogleSheet interface imported from Types
import { GoogleSheet } from '@/lib/types';

interface SettingsPanelProps {
    chatbot: Chatbot;
    isOpen: boolean;
    onClose: () => void;
}

interface IntegrationData {
    id: string;
    chatbot_id: string;
    platform: string;
    config: Record<string, string>;
    is_active: boolean;
    created_at: string;
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

    // Google Auth State
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [usePrivateSheet, setUsePrivateSheet] = useState(false);

    // Integration state
    const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
    const [loadingIntegrations, setLoadingIntegrations] = useState(false);

    // WhatsApp shared-number
    const [waStatus, setWaStatus] = useState<any>(null);
    const [enablingWa, setEnablingWa] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);

    // Telegram form
    const [tgBotToken, setTgBotToken] = useState('');
    const [connectingTg, setConnectingTg] = useState(false);
    const [showTgToken, setShowTgToken] = useState(false);

    useEffect(() => {
        if (isOpen && chatbot.id) {
            loadDocuments();
            loadEmbeddingCount();
            loadGoogleSheets();
            checkGoogleStatus();
            loadIntegrations();
            loadWhatsAppStatus();
        }
    }, [isOpen, chatbot.id]);

    const checkGoogleStatus = async () => {
        try {
            const status = await api.getGoogleAuthStatus();
            setIsGoogleConnected(status.connected);
        } catch (error) {
            console.error('Failed to check Google status:', error);
        }
    };

    const handleConnectGoogle = async () => {
        try {
            const { url } = await api.getGoogleAuthUrl();
            localStorage.setItem('google_auth_return_url', window.location.href);
            window.location.href = url;
        } catch (error: any) {
            toast.error('Failed to initiate Google Login');
        }
    };

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

    const loadIntegrations = async () => {
        setLoadingIntegrations(true);
        try {
            const result = await api.getIntegrations(chatbot.id);
            setIntegrations(result);
        } catch (error) {
            console.error('Failed to load integrations:', error);
        } finally {
            setLoadingIntegrations(false);
        }
    };

    const loadWhatsAppStatus = async () => {
        try {
            const result = await api.getWhatsAppStatus(chatbot.id);
            setWaStatus(result);
        } catch (error) {
            console.error('Failed to load WhatsApp status:', error);
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
            if (usePrivateSheet) {
                if (!isGoogleConnected) throw new Error("Please connect your Google Account first.");
                await api.addStructuredSheet(chatbot.id, sheetUrl, sheetName || 'Google Sheet');
            } else {
                await api.addGoogleSheet(chatbot.id, sheetUrl, sheetName || 'Google Sheet');
            }

            toast.success('Google Sheet connected and data synced!');
            setSheetUrl('');
            setSheetName('');
            setUsePrivateSheet(false);
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

    // ── Integration Handlers ────────────────────────────

    const handleEnableWhatsApp = async () => {
        setEnablingWa(true);
        try {
            const result = await api.enableWhatsApp(chatbot.id);
            setWaStatus(result);
            toast.success('WhatsApp enabled! Share the access code with your users.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to enable WhatsApp');
        } finally {
            setEnablingWa(false);
        }
    };

    const handleDisableWhatsApp = async () => {
        if (!confirm('Disable WhatsApp? Users will no longer be able to message this chatbot via WhatsApp.')) return;
        try {
            await api.disableWhatsApp(chatbot.id);
            setWaStatus(null);
            toast.success('WhatsApp disabled');
        } catch (error: any) {
            toast.error(error.message || 'Failed to disable WhatsApp');
        }
    };

    const copyAccessCode = (code: string) => {
        navigator.clipboard.writeText(`START ${code}`);
        setCodeCopied(true);
        toast.success('Access code copied!');
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const handleConnectTelegram = async () => {
        if (!tgBotToken.trim()) {
            toast.error('Please enter your Telegram Bot Token');
            return;
        }
        setConnectingTg(true);
        try {
            await api.createIntegration(chatbot.id, 'telegram', {
                bot_token: tgBotToken.trim(),
            });
            toast.success('Telegram bot connected! Webhook registered automatically.');
            setTgBotToken('');
            loadIntegrations();
        } catch (error: any) {
            toast.error(error.message || 'Failed to connect Telegram');
        } finally {
            setConnectingTg(false);
        }
    };

    const handleToggleIntegration = async (integ: IntegrationData) => {
        try {
            await api.updateIntegration(chatbot.id, integ.id, { is_active: !integ.is_active });
            toast.success(`${integ.platform} ${integ.is_active ? 'paused' : 'activated'}`);
            loadIntegrations();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update');
        }
    };

    const handleDisconnectIntegration = async (integ: IntegrationData) => {
        if (!confirm(`Disconnect ${integ.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}? This will stop receiving messages.`)) return;
        try {
            await api.deleteIntegration(chatbot.id, integ.id);
            toast.success(`${integ.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'} disconnected`);
            loadIntegrations();
        } catch (error: any) {
            toast.error(error.message || 'Failed to disconnect');
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

    // Helper: get existing integration by platform
    const tgIntegration = integrations.find(i => i.platform === 'telegram');
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-dark-900 border-l border-dark-800 z-50 flex flex-col animate-slide-in-left shadow-2xl">
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
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center">
                                        <FileSpreadsheet className="w-3 h-3 text-green-400" />
                                    </div>
                                    <h4 className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                                        Google Sheets
                                    </h4>
                                </div>
                                {!isGoogleConnected && (
                                    <button
                                        onClick={handleConnectGoogle}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                        <Globe className="w-3 h-3" /> Connect Account
                                    </button>
                                )}
                                {isGoogleConnected && (
                                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Account Connected
                                    </span>
                                )}
                            </div>

                            {/* Add Sheet Form */}
                            <div className="p-4 rounded-xl bg-dark-800/30 border border-dark-700 space-y-3">
                                <input
                                    type="text"
                                    value={sheetUrl}
                                    onChange={(e) => setSheetUrl(e.target.value)}
                                    placeholder={usePrivateSheet ? "Paste Private Google Sheet URL..." : "Paste Public Google Sheet URL..."}
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
                                        disabled={addingSheet || !sheetUrl.trim() || (usePrivateSheet && !isGoogleConnected)}
                                        className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium
                                            hover:bg-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                            flex items-center gap-1.5 border border-green-500/20"
                                    >
                                        {addingSheet ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Plus className="w-3.5 h-3.5" />
                                        )}
                                        {addingSheet ? 'Syncing...' : 'Add'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-dark-400 hover:text-dark-300">
                                        <input
                                            type="checkbox"
                                            checked={usePrivateSheet}
                                            onChange={(e) => setUsePrivateSheet(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded bg-dark-700 border-dark-600 text-brand-500 focus:ring-0 focus:ring-offset-0"
                                        />
                                        Use Private Access (OAuth)
                                    </label>

                                    {usePrivateSheet && !isGoogleConnected && (
                                        <button onClick={handleConnectGoogle} className="text-[10px] text-blue-400 hover:underline">
                                            Sign in to Google required
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-dark-500 leading-relaxed">
                                    {usePrivateSheet
                                        ? "ⓘ Uses your connected Google account to access private sheets. Data is stored as structured tables."
                                        : "ⓘ Sheet must be 'Anyone with link'. Data is embedded for semantic search."}
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
                                            {sheet.access_mode === 'oauth' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    Private
                                                </span>
                                            )}
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
                    <div className="space-y-5">
                        {loadingIntegrations ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 text-dark-500 animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* ─── WhatsApp (Shared Number) ──────────── */}
                                <div className="rounded-xl bg-dark-800/50 border border-dark-700 overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-dark-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                                                <MessageCircle className="w-5 h-5 text-green-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">WhatsApp</h4>
                                                <p className="text-xs text-dark-500">Shared Number</p>
                                            </div>
                                        </div>
                                        {waStatus?.enabled && (
                                            <span className={`text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1
                                                ${waStatus.verified
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                }`}
                                            >
                                                <Power className="w-2.5 h-2.5" />
                                                {waStatus.verified ? 'Verified' : 'Pending'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {waStatus?.enabled ? (
                                            <>
                                                {/* Access Code Display */}
                                                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                                    <p className="text-[10px] text-dark-500 mb-1.5">Access Code</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg font-bold text-green-400 font-mono tracking-wider">{waStatus.access_code}</span>
                                                        <button
                                                            onClick={() => copyAccessCode(waStatus.access_code)}
                                                            className="p-1.5 rounded-lg bg-dark-700 text-dark-400 hover:text-dark-200 transition-all"
                                                        >
                                                            {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Instructions */}
                                                <div className="p-2.5 rounded-lg bg-dark-800 border border-dark-700">
                                                    <p className="text-[10px] text-dark-500 mb-1">Instructions for users</p>
                                                    <p className="text-xs text-dark-300">Send <span className="font-mono text-green-400">START {waStatus.access_code}</span> to our WhatsApp number to connect.</p>
                                                </div>

                                                {/* Status info */}
                                                {waStatus.verified && waStatus.whatsapp_phone && (
                                                    <div className="text-xs text-dark-400">
                                                        <p>Linked phone: <span className="text-dark-300 font-mono">{waStatus.whatsapp_phone}</span></p>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={handleDisableWhatsApp}
                                                    className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Disable WhatsApp
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-dark-400 leading-relaxed">
                                                    Enable WhatsApp to let users message your chatbot via our shared WhatsApp number.
                                                    You&apos;ll get a unique access code to share with your users.
                                                </p>

                                                <button
                                                    onClick={handleEnableWhatsApp}
                                                    disabled={enablingWa}
                                                    className="w-full px-4 py-2.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium
                                                        hover:bg-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                                        flex items-center justify-center gap-2 border border-green-500/20"
                                                >
                                                    {enablingWa ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <MessageCircle className="w-4 h-4" />
                                                    )}
                                                    {enablingWa ? 'Enabling...' : 'Enable WhatsApp'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ─── Telegram ────────────────────────── */}
                                <div className="rounded-xl bg-dark-800/50 border border-dark-700 overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-dark-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                                <SendIcon className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Telegram</h4>
                                                <p className="text-xs text-dark-500">Bot API</p>
                                            </div>
                                        </div>
                                        {tgIntegration && (
                                            <span className={`text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1
                                                ${tgIntegration.is_active
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                }`}
                                            >
                                                <Power className="w-2.5 h-2.5" />
                                                {tgIntegration.is_active ? 'Active' : 'Paused'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {tgIntegration ? (
                                            <>
                                                <div className="text-xs text-dark-400 space-y-1.5">
                                                    <p>Bot Token: <span className="text-dark-300 font-mono">{tgIntegration.config.bot_token}</span></p>
                                                </div>

                                                <div className="p-2.5 rounded-lg bg-dark-800 border border-dark-700">
                                                    <p className="text-[10px] text-dark-500 mb-1">Webhook URL (auto-registered)</p>
                                                    <p className="text-xs text-dark-300 font-mono break-all">{backendUrl}/api/webhooks/telegram/{'<token>'}</p>
                                                </div>

                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => handleToggleIntegration(tgIntegration)}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
                                                            ${tgIntegration.is_active
                                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                                                                : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                                                            }`}
                                                    >
                                                        <Power className="w-3 h-3" />
                                                        {tgIntegration.is_active ? 'Pause' : 'Activate'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDisconnectIntegration(tgIntegration)}
                                                        className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Disconnect
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-dark-400 leading-relaxed">
                                                    Create a bot via
                                                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5">
                                                        @BotFather <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                    , then paste the token below. Webhook will be registered automatically.
                                                </p>

                                                <div className="relative">
                                                    <input
                                                        type={showTgToken ? 'text' : 'password'}
                                                        value={tgBotToken}
                                                        onChange={(e) => setTgBotToken(e.target.value)}
                                                        placeholder="Bot Token from @BotFather"
                                                        className="w-full px-3 py-2 pr-10 rounded-lg bg-dark-800 border border-dark-600 text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                                                    />
                                                    <button
                                                        onClick={() => setShowTgToken(!showTgToken)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-300"
                                                    >
                                                        {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={handleConnectTelegram}
                                                    disabled={connectingTg || !tgBotToken.trim()}
                                                    className="w-full px-4 py-2.5 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium
                                                        hover:bg-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                                        flex items-center justify-center gap-2 border border-blue-500/20"
                                                >
                                                    {connectingTg ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <SendIcon className="w-4 h-4" />
                                                    )}
                                                    {connectingTg ? 'Connecting...' : 'Connect Telegram'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
