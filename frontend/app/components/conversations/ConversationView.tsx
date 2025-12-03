'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { memoryMeshAPI } from '@/lib/api';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    importance_score: number | null;
    metadata: Record<string, any>;
}

export default function ConversationView({ conversationId }: { conversationId: string | null }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (!conversationId || !user?.tenant_id) return;

        const loadData = async () => {
            setLoading(true);
            try {
                // Load conversation stats
                const statsResponse = await memoryMeshAPI.getConversationStats(
                    conversationId,
                    user.tenant_id
                );
                if (statsResponse.data) {
                    setStats(statsResponse.data);
                }

                // Search for messages in this conversation
                const searchResponse = await memoryMeshAPI.searchMemories({
                    query: '',
                    tenant_id: user.tenant_id,
                    conversation_id: conversationId,
                    top_k: 100,
                });

                if (searchResponse.data?.items) {
                    // Sort by created_at
                    const sorted = searchResponse.data.items.sort(
                        (a: any, b: any) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    setMessages(
                        sorted.map((item: any) => ({
                            id: item.message_id,
                            role: item.role,
                            content: item.content,
                            created_at: item.created_at,
                            importance_score: item.importance,
                            metadata: item.metadata || {},
                        }))
                    );
                }
            } catch (error) {
                toast.error('Failed to load conversation');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [conversationId, user?.tenant_id]);

    if (!conversationId) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                    <Icon icon="material-symbols:chat-outline" className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view messages</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-blue-600" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {stats && (
                <div className="bg-gray-50 p-4 mb-4 rounded-lg border">
                    <h3 className="font-semibold mb-2">Conversation Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-600">Total Messages</p>
                            <p className="font-semibold">{stats.total_messages}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">User Messages</p>
                            <p className="font-semibold">{stats.user_messages}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Assistant Messages</p>
                            <p className="font-semibold">{stats.assistant_messages}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Avg Importance</p>
                            <p className="font-semibold">
                                {stats.avg_importance
                                    ? stats.avg_importance.toFixed(2)
                                    : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No messages in this conversation</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`p-4 rounded-lg ${
                                message.role === 'user'
                                    ? 'bg-blue-50 ml-8'
                                    : message.role === 'assistant'
                                    ? 'bg-gray-50 mr-8'
                                    : 'bg-yellow-50'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase text-gray-600">
                                        {message.role}
                                    </span>
                                    {message.importance_score !== null && (
                                        <span className="text-xs text-gray-500">
                                            Importance: {message.importance_score.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400">
                                    {new Date(message.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {Object.keys(message.metadata).length > 0 && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer">
                                        Metadata
                                    </summary>
                                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto">
                                        {JSON.stringify(message.metadata, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

