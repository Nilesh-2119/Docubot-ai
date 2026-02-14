'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import {
    Upload, FileText, X, Check, AlertCircle, Loader2,
    FileSpreadsheet, File
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentUploadProps {
    chatbotId: string;
    onUploadComplete: () => void;
}

interface UploadingFile {
    file: File;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
    chunks?: number;
}

const FILE_ICONS: Record<string, React.ComponentType<any>> = {
    pdf: FileText,
    docx: FileText,
    xlsx: FileSpreadsheet,
    csv: FileSpreadsheet,
    txt: File,
};

export default function DocumentUpload({
    chatbotId,
    onUploadComplete,
}: DocumentUploadProps) {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
                file,
                progress: 0,
                status: 'uploading' as const,
            }));

            setUploadingFiles((prev) => [...prev, ...newFiles]);

            for (let i = 0; i < acceptedFiles.length; i++) {
                const file = acceptedFiles[i];
                try {
                    // Simulate progress
                    const progressInterval = setInterval(() => {
                        setUploadingFiles((prev) =>
                            prev.map((f) =>
                                f.file === file && f.status === 'uploading'
                                    ? { ...f, progress: Math.min(f.progress + 10, 90) }
                                    : f
                            )
                        );
                    }, 300);

                    const result = await api.uploadDocument(chatbotId, file);

                    clearInterval(progressInterval);

                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.file === file
                                ? { ...f, progress: 100, status: 'success', chunks: result.chunk_count }
                                : f
                        )
                    );

                    toast.success(`${file.name} processed — ${result.chunk_count} chunks created`);
                } catch (error: any) {
                    setUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.file === file
                                ? { ...f, status: 'error', error: error.message }
                                : f
                        )
                    );
                    toast.error(`Failed to upload ${file.name}`);
                }
            }

            onUploadComplete();
        },
        [chatbotId, onUploadComplete]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'text/csv': ['.csv'],
            'text/plain': ['.txt'],
        },
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    const removeFile = (file: File) => {
        setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
    };

    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const Icon = FILE_ICONS[ext] || File;
        return <Icon className="w-5 h-5" />;
    };

    return (
        <div className="space-y-4">
            {/* Drop zone */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragActive
                        ? 'border-brand-500 bg-brand-500/5'
                        : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/30'
                    }`}
            >
                <input {...getInputProps()} />
                <Upload
                    className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-brand-400' : 'text-dark-500'
                        }`}
                />
                <p className="text-sm text-dark-300 mb-1">
                    {isDragActive ? 'Drop files here...' : 'Drag & drop documents here'}
                </p>
                <p className="text-xs text-dark-500">
                    PDF, DOCX, XLSX, CSV, TXT — Max 10MB
                </p>
            </div>

            {/* Upload progress */}
            {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                    {uploadingFiles.map((upload, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 border border-dark-700 animate-slide-up"
                        >
                            <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${upload.status === 'success' ? 'bg-emerald-500/10 text-emerald-400'
                                        : upload.status === 'error' ? 'bg-red-500/10 text-red-400'
                                            : 'bg-dark-700 text-dark-400'
                                    }`}
                            >
                                {getFileIcon(upload.file.name)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-dark-200 truncate">{upload.file.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {upload.status === 'uploading' && (
                                        <>
                                            <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${upload.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-dark-500">{upload.progress}%</span>
                                        </>
                                    )}
                                    {upload.status === 'success' && (
                                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            {upload.chunks} chunks created
                                        </span>
                                    )}
                                    {upload.status === 'error' && (
                                        <span className="text-xs text-red-400 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {upload.error || 'Upload failed'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => removeFile(upload.file)}
                                className="p-1 text-dark-500 hover:text-dark-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
