'use client';

import { PersonSearch } from '@/components/PersonSearch';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n-context';
import { useState, useEffect } from 'react';

export default function Home() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ totalPersons: number } | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/public/stats');
        const result = await response.json();
        if (result.success && result.data) {
          setStats({ totalPersons: result.data.totalPersons });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="fixed inset-0 top-20 md:top-16 flex flex-col items-center justify-center bg-background px-4 sm:px-6 lg:px-8 pb-16">
      <div className="text-center mb-12 lg:mb-16">
        <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl min-[1440px]:text-7xl text-foreground">
          {t('home.title')}
        </h1>
        <p className="mx-auto max-w-3xl text-lg sm:text-xl lg:text-2xl min-[1440px]:text-4xl text-foreground/60 leading-relaxed tracking-tight">
          {t('home.subtitle')}
          <span className="text-destructive font-bold">
            {' '}{stats ? <AnimatedCounter end={stats.totalPersons} /> : 0}{' '}
          </span>
          {t('home.subtitleCount')} <span className="font-bold text-foreground">{t('home.subtitleLocation')}</span> {t('home.subtitleEvent')}
        </p>
      </div>

      <div className="w-full max-w-sm lg:max-w-md">
        <Card className="py-0 border-2 shadow-2xl bg-card/80 backdrop-blur-md border-border rounded-2xl">
          <CardContent className="pt-5 pb-5 px-5 lg:pt-8 lg:pb-8 lg:px-6">
            <p className="text-center text-muted-foreground text-sm mb-3">
              {t('home.searchExplainer')}
            </p>
            <PersonSearch />
            <p className="text-center text-muted-foreground text-sm mt-4">
              {t('home.contributeText')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
