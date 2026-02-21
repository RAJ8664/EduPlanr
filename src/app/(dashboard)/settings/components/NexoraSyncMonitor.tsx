'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store';
import { Activity, ArrowDownCircle, CheckCircle, Wifi, BookOpen, Clock } from 'lucide-react';
import { Card } from '@/components/ui';

export function NexoraSyncMonitor() {
    const { user, profile } = useAuthStore();
    const [contextData, setContextData] = useState<any>(null);
    const [recentUpdates, setRecentUpdates] = useState<number>(0);

    useEffect(() => {
        if (!user?.uid || !profile?.syncToken) return;

        const unsubscribe = onSnapshot(
            doc(db, 'nexoraContext', user.uid),
            (doc) => {
                if (doc.exists()) {
                    setContextData(doc.data());
                    // Flash animation when data arrives
                    setRecentUpdates(prev => prev + 1);
                    setTimeout(() => setRecentUpdates(0), 3000);
                }
            }
        );

        return () => unsubscribe();
    }, [user?.uid, profile?.syncToken]);

    const isConnected = !!profile?.syncToken;

    const timeAgo = (ts: any) => {
        if (!ts) return 'Never';
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        const diff = Date.now() - date.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    };

    if (!isConnected) return null;

    return (
        <Card className="border border-neon-cyan/20 overflow-hidden relative">
            {recentUpdates > 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-shimmer pointer-events-none"
                    style={{ animation: 'shimmer 2s ease-in-out infinite' }} />
            )}

            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-neon-cyan" />
                        Live Sync Connection
                    </h3>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                        <div className="relative flex items-center justify-center w-2 h-2">
                            <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-emerald-400"></span>
                            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <span className="text-xs font-medium text-emerald-400">Connected</span>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center justify-between p-4 bg-dark-800/80 rounded-xl border border-dark-600/50">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-cyan-500/20 ring-2 ring-cyan-400/50">
                            <Wifi className="w-6 h-6 text-cyan-400" />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">Nexora Hub</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center min-w-[150px]">
                        <div className="flex items-center gap-2 text-purples-400 w-full justify-center">
                            <ArrowDownCircle className={`w-4 h-4 text-purple-400 ${recentUpdates > 0 ? 'animate-bounce' : ''}`} />
                            <div className="flex gap-1">
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${recentUpdates > 0 ? 'bg-purple-400 scale-125' : 'bg-dark-600'}`}
                                        style={recentUpdates > 0 ? { transitionDelay: `${i * 100}ms` } : {}}
                                    />
                                ))}
                            </div>
                        </div>
                        <span className="text-[10px] text-gray-500 mt-2 font-medium uppercase tracking-wider">
                            Real-time Data Stream
                        </span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-purple-500/20 ring-2 ring-purple-400/30">
                            <BookOpen className="w-6 h-6 text-purple-400" />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">EduPlanr</span>
                    </div>
                </div>

                {contextData && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="p-3 bg-dark-800/50 rounded-lg border border-dark-600/30">
                            <p className="text-xs text-gray-500 mb-1">Wellness Pulse</p>
                            <p className="text-sm font-medium text-white">
                                {contextData.wellness ? `${contextData.wellness.energy} energy` : 'Waiting...'}
                            </p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg border border-dark-600/30">
                            <p className="text-xs text-gray-500 mb-1">Active Habits</p>
                            <p className="text-sm font-medium text-white">
                                {contextData.habits?.length || 0} tracking
                            </p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg border border-dark-600/30">
                            <p className="text-xs text-gray-500 mb-1">Active Goals</p>
                            <p className="text-sm font-medium text-white">
                                {contextData.goals?.length || 0} in progress
                            </p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg border border-dark-600/30">
                            <p className="text-xs text-gray-500 mb-1">Last Synced</p>
                            <p className="text-sm font-medium text-white flex items-center gap-1">
                                <Clock className="w-3 h-3 text-cyan-500" />
                                {timeAgo(contextData.lastSyncedAt)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </Card>
    );
}
