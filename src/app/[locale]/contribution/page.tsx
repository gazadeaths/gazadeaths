'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n-context';

interface Contribution {
  id: string;
  type: 'EDIT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  createdAt: string;
  proposedPayload: Record<string, string | number | boolean | null>;
  reason?: string;
  decisionNote?: string;
  approvedAt?: string;
  personId?: string;
}

export default function CommunityContributePage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const { t } = useTranslation();
  
  const [contributions, setContributions] = useState<Contribution[]>([]);

  const fetchContributions = useCallback(async () => {
    try {
      const response = await fetch('/api/community/my-submissions');
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setContributions(data.submissions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contributions:', error);
    }
  }, []);

  // Load user's contribution history
  useEffect(() => {
    if (isSignedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetching data on mount is a valid use case
      fetchContributions();
    }
  }, [isSignedIn, fetchContributions]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-8 pb-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('contribution.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('contribution.subtitle')}</p>
        </div>

        {!isSignedIn && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">{t('contribution.signInRequired')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('contribution.signInMessage')}
            </p>
            <div className="flex gap-3">
              <Button onClick={() => router.push('/sign-in')}>
                {t('contribution.signIn')}
              </Button>
              <Button onClick={() => router.push('/sign-up')} variant="outline">
                {t('contribution.signUp')}
              </Button>
            </div>
          </div>
        )}

        {isSignedIn && (
          <div className="bg-card border rounded-lg p-6">
            <div>
              {contributions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{t('contribution.noContributions')}</p>
                  <p className="text-sm mt-2">{t('contribution.noContributionsHint')}</p>
                </div>
              ) : (
                  <div className="space-y-4">
                    {contributions.map((contribution) => (
                      <div key={contribution.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3 rtl:space-x-reverse">
                            <span className="px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary">
                              {t('contribution.type.EDIT')}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              contribution.status === 'PENDING' ? 'bg-secondary/50 text-secondary-foreground' :
                              contribution.status === 'APPROVED' ? 'bg-accent text-accent-foreground' :
                              contribution.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' :
                              'bg-accent text-accent-foreground'
                            }`}>
                              {t(`contribution.status.${contribution.status}`)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground force-ltr">
                            {new Date(contribution.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-sm text-foreground mb-2">
                          <p className="font-medium">{t('contribution.editTo')} {contribution.personId || 'N/A'}</p>
                          <p className="text-muted-foreground">
                            {t('contribution.fields')} {Object.keys(contribution.proposedPayload).join(', ')}
                          </p>
                        </div>

                        {contribution.reason && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">{t('contribution.yourNote')}</span> {contribution.reason}
                          </p>
                        )}

                        {contribution.status === 'APPROVED' && contribution.approvedAt && (
                          <p className="text-sm text-accent-foreground force-ltr">
                            ✓ {t('contribution.approved')} {new Date(contribution.approvedAt).toLocaleDateString()}
                          </p>
                        )}

                        {contribution.status === 'REJECTED' && contribution.decisionNote && (
                          <p className="text-sm text-destructive">
                            <span className="font-medium">{t('contribution.moderatorNote')}</span> {contribution.decisionNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
