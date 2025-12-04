'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { memoryMeshAPI } from '@/lib/api';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function DataExporter() {
    const { user } = useAuth();
    const [exporting, setExporting] = useState(false);
    const [format, setFormat] = useState<'json' | 'csv'>('json');

    const exportConversations = async () => {
        if (!user?.tenant_id) {
            toast.error('Tenant ID required');
            return;
        }

        setExporting(true);
        try {
            const response = await memoryMeshAPI.listConversations({
                tenant_id: user.tenant_id,
                page: 1,
                page_size: 1000,
            });

            if (!response.data) {
                toast.error('Failed to fetch conversations');
                return;
            }

            const data = response.data.conversations;
            let content: string;
            let filename: string;
            let mimeType: string;

            if (format === 'json') {
                content = JSON.stringify(data, null, 2);
                filename = `conversations_${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
            } else {
                // CSV format
                const headers = ['id', 'tenant_id', 'title', 'message_count', 'created_at', 'archived'];
                const rows = data.map((conv: any) => [
                    conv.id,
                    conv.tenant_id,
                    conv.title || '',
                    conv.message_count,
                    conv.created_at,
                    conv.archived,
                ]);
                content = [headers, ...rows].map((row) => row.join(',')).join('\n');
                filename = `conversations_${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
            }

            // Download file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Exported ${data.length} conversations`);
        } catch (error) {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-4 bg-white rounded-lg border">
            <h3 className="font-semibold mb-4">Export Data</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Format</label>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                    </select>
                </div>
                <button
                    onClick={exportConversations}
                    disabled={exporting}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {exporting ? (
                        <>
                            <Icon icon="svg-spinners:3-dots-fade" className="w-5 h-5" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <Icon icon="material-symbols:download" className="w-5 h-5" />
                            Export Conversations
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

