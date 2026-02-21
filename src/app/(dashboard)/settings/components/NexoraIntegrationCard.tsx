import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Button, Input, ConfirmModal } from '@/components/ui';
import { useAuthStore } from '@/store';
import { generateSyncToken, revokeSyncToken } from '@/services/authService';
import { KeyIcon } from '@heroicons/react/24/outline';
import { parseErrorMessage } from '@/lib/utils';

export function NexoraIntegrationCard() {
    const { user, profile, setProfile } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

    const handleGenerate = async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            const token = await generateSyncToken(user.uid);
            if (profile) {
                setProfile({ ...profile, syncToken: token, updatedAt: new Date() });
            }
            toast.success("Sync token generated successfully");
        } catch (error: any) {
            toast.error(error.message || "Failed to generate token");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!user?.uid) return;
        setShowRevokeConfirm(false);

        setLoading(true);
        try {
            await revokeSyncToken(user.uid);
            if (profile) {
                setProfile({ ...profile, syncToken: null, updatedAt: new Date() });
            }
            toast.success("Sync token revoked");
        } catch (error: any) {
            toast.error(error.message || "Failed to revoke token");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Card className="border border-dark-600/50 overflow-hidden">
            <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                    <KeyIcon className="w-5 h-5 text-neon-cyan" />
                    Nexora Integration
                </h3>
                <p className="text-sm text-gray-400 mb-6 font-medium leading-relaxed">
                    Connect your EduPlanr academic data to Nexora to automatically sync your assignments and study sessions to your master calendar. You must copy your EduPlanr Email and your Sync Token into the Nexora Integrations settings to establish the link.
                </p>

                <div className="space-y-6">
                    <div className="p-5 bg-dark-800/80 rounded-xl border border-dark-600/30">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Account Email
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 opacity-70 cursor-not-allowed">
                                <Input
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full"
                                />
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => copyToClipboard(user?.email || '', 'Email')}
                                disabled={!user?.email}
                                className="shrink-0"
                            >
                                Copy Email
                            </Button>
                        </div>
                    </div>

                    <div className="p-5 bg-dark-800/80 rounded-xl border border-dark-600/30">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Sync Token
                        </label>
                        {profile?.syncToken ? (
                            <div className="space-y-5">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 w-full">
                                        <Input
                                            type="password"
                                            value={profile.syncToken}
                                            disabled
                                            className="w-full font-mono text-neon-cyan/90 opacity-90 cursor-text"
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={() => copyToClipboard(profile.syncToken!, 'Sync token')}
                                        className="shrink-0"
                                    >
                                        Copy Token
                                    </Button>
                                </div>

                                <div className="pt-5 border-t border-dark-700 mt-2">
                                    <div className="flex justify-between items-center flex-wrap gap-4">
                                        <p className="text-xs text-red-400/80 font-medium">Use caution: Revoking breaks Nexora sync</p>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setShowRevokeConfirm(true)}
                                            disabled={loading}
                                        >
                                            {loading ? 'Revoking...' : 'Revoke Connection'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-2">
                                <Button
                                    variant="primary"
                                    onClick={handleGenerate}
                                    disabled={loading}
                                >
                                    {loading ? 'Generating...' : 'Generate Sync Token'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <ConfirmModal
                    isOpen={showRevokeConfirm}
                    onClose={() => setShowRevokeConfirm(false)}
                    onConfirm={handleRevoke}
                    title="Revoke Connection"
                    message="Revoking this token will immediately sever the connection and block Nexora from syncing new data. Are you sure?"
                    confirmText="Revoke"
                    isDestructive={true}
                    isLoading={loading}
                />
            </div>
        </Card>
    );
}
