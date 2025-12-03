'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { memoryMeshAPI } from '@/lib/api';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

interface Conversation {
    id: string;
    tenant_id: string;
    title: string | null;
    message_count: number;
    last_message_at: string | null;
    created_at: string;
    archived: boolean;
}

export default function ConversationList({ onSelect }: { onSelect: (id: string) => void }) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const loadConversations = async () => {
        if (!user?.tenant_id) return;

        setLoading(true);
        try {
            const response = await memoryMeshAPI.listConversations({
                tenant_id: user.tenant_id,
                page,
                page_size: 20,
            });

            if (response.data) {
                setConversations(response.data.conversations);
                setTotal(response.data.total);
            }
        } catch (error) {
            toast.error('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
    }, [user?.tenant_id, page]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        onSelect(id);
    };

    if (loading && conversations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Conversations</h2>
                <button
                    onClick={() => loadConversations()}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Refresh conversations"
                >
                    <Icon icon="material-symbols:refresh" className="w-5 h-5" />
                </button>
            </div>

            {conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Icon icon="material-symbols:chat-outline" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => handleSelect(conv.id)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                                selectedId === conv.id
                                    ? 'bg-blue-100 border-2 border-blue-500'
                                    : 'bg-white border-2 border-transparent hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                        {conv.title || conv.id}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {conv.message_count} messages
                                    </p>
                                    {conv.last_message_at && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(conv.last_message_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                {conv.archived && (
                                    <Icon
                                        icon="material-symbols:archive"
                                        className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0"
                                    />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {total > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-600">
                        Page {page} of {Math.ceil(total / 20)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 20)}
                        className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

