import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'DocuBot AI — Intelligent Document Chatbots',
    description:
        'Upload documents and create AI chatbots powered by RAG. Embed on your website, connect to WhatsApp and Telegram.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-dark-950">
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#1e293b',
                            color: '#f1f5f9',
                            border: '1px solid #334155',
                            borderRadius: '12px',
                        },
                    }}
                />
                {children}
            </body>
        </html>
    );
}
