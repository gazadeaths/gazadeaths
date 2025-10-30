'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, MapPin, Clock, Database, Edit } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PersonSearch } from '@/components/PersonSearch';
import { useTranslation, useFormatDate } from '@/lib/i18n-context';

// Dynamically import LocationPicker to avoid SSR issues with Leaflet
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-96 w-full bg-muted rounded-md flex items-center justify-center">
    <p className="text-muted-foreground">{/* Loading map... */}</p>
  </div>
});

interface PersonVersion {
  id: string;
  versionNumber: number;
  changeType: string;
  externalId: string;
  name: string;
  nameEnglish: string | null;
  gender: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  locationOfDeathLat: number | null;
  locationOfDeathLng: number | null;
  photoUrlThumb: string | null;
  photoUrlOriginal: string | null;
  isDeleted: boolean;
  createdAt: string;
  source: {
    id: string;
    type: string;
    description: string;
    bulkUpload: {
      id: string;
      filename: string;
      comment: string | null;
      dateReleased: string;
    } | null;
    communitySubmission: {
      id: string;
      submittedBy: string;
      reason: string | null;
    } | null;
  };
}

interface Person {
  id: string;
  externalId: string;
  name: string;
  nameEnglish: string | null;
  gender: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  locationOfDeathLat: number | null;
  locationOfDeathLng: number | null;
  photoUrlThumb: string | null;
  photoUrlOriginal: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  versions: PersonVersion[];
}

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const externalId = params.externalId as string;
  const { t, locale } = useTranslation();
  const { formatDate, formatDateTime } = useFormatDate();

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scroll to top when page loads or externalId changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [externalId]);

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        const response = await fetch(`/api/public/person/${externalId}?includeHistory=true`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch person');
          return;
        }

        setPerson(data.person);
      } catch (err) {
        setError('An error occurred while fetching person details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerson();
  }, [externalId]);

  const getChangeTypeBadge = (changeType: string) => {
    const type = changeType as 'INSERT' | 'UPDATE' | 'DELETE';
    const label = t(`person.versionHistory.changeTypes.${type}`);
    
    switch (changeType) {
      case 'INSERT':
        return <Badge variant="default">{label}</Badge>;
      case 'UPDATE':
        return <Badge variant="secondary">{label}</Badge>;
      case 'DELETE':
        return <Badge variant="destructive">{label}</Badge>;
      default:
        return <Badge variant="outline">{changeType}</Badge>;
    }
  };

  const getSourceBadge = (source: PersonVersion['source']) => {
    if (source.type === 'BULK_UPLOAD') {
      return <Badge variant="default">{t('person.versionHistory.sources.BULK_UPLOAD')}</Badge>;
    } else if (source.type === 'COMMUNITY_SUBMISSION') {
      return <Badge variant="secondary">{t('person.versionHistory.sources.COMMUNITY_SUBMISSION')}</Badge>;
    }
    return <Badge variant="outline">{source.type}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('person.back')}
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            {error || t('person.fields.externalId')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center h-16 px-4 sm:px-6 lg:px-8 border-b gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-0 text-accent-foreground" />
          {t('person.back')}
        </Button>
        
        {/* Centered Search - Desktop only */}
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          <PersonSearch variant="header" />
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" asChild>
            <Link href={`/${locale}/contribution/edit/${externalId}`}>
              <Edit className="w-4 h-4 mr-0 text-accent-foreground" />
              {t('person.contribute')}
            </Link>
          </Button>
          {person.isDeleted && (
            <Badge variant="destructive">{t('person.deleted')}</Badge>
          )}
        </div>
      </div>

      {/* Person Name */}
      <div className="px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        {locale === 'ar' ? (
          <>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground">{person.name}</h1>
            {person.nameEnglish && (
              <h2 className="text-2xl sm:text-3xl lg:text-4xl text-muted-foreground mt-2">
                {person.nameEnglish}
              </h2>
            )}
          </>
        ) : (
          <>
            {person.nameEnglish ? (
              <>
                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground">{person.nameEnglish}</h1>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl text-muted-foreground mt-2">
                  {person.name}
                </h2>
              </>
            ) : (
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground">{person.name}</h1>
            )}
          </>
        )}
      </div>

      {/* Main Person Card and Photo */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex flex-col-reverse md:flex-row gap-6">
          <Card className={`w-full ${person.photoUrlThumb ? 'md:w-2/3' : ''}`}>
            <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* External ID */}
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.externalId')}</p>
                <p className="text-lg font-mono force-ltr">{person.externalId}</p>
              </div>
            </div>

            {/* Gender */}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.gender')}</p>
                <Badge
                  variant={
                    person.gender === 'MALE' ? 'default' :
                    person.gender === 'FEMALE' ? 'secondary' :
                    'outline'
                  }
                  className="mt-1"
                >
                  {t(`person.gender.${person.gender}`)}
                </Badge>
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.dateOfBirth')}</p>
                <p className="text-lg force-ltr">{formatDate(person.dateOfBirth)}</p>
              </div>
            </div>

            {/* Date of Death */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.dateOfDeath')}</p>
                <p className="text-lg text-destructive force-ltr">
                  {formatDate(person.dateOfDeath)}
                </p>
              </div>
            </div>

            {/* Location */}
            {person.locationOfDeathLat && person.locationOfDeathLng && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">{t('person.fields.location')}</p>
                </div>
                <LocationPicker
                  initialLat={person.locationOfDeathLat}
                  initialLng={person.locationOfDeathLng}
                  readOnly={true}
                />
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.created')}</p>
                <p className="text-sm force-ltr">{formatDateTime(person.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('person.fields.lastUpdated')}</p>
                <p className="text-sm force-ltr">{formatDateTime(person.updatedAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Person Photo */}
      {person.photoUrlThumb && (
        <div className="w-full md:w-1/3 aspect-square rounded-lg border border-dashed border-white/80 p-3 bg-card/20 relative">
          <div className="absolute inset-3 z-10 flex items-center justify-center">
            <div className="rounded-md border border-border bg-background/70 text-foreground text-center text-xs font-medium tracking-wide px-2 py-1">
              {t('person.exampleImage')}
            </div>
          </div>
          <Image
            src={person.photoUrlThumb}
            alt={`Photo of ${person.name}`}
            width={400}
            height={400}
            className="w-full h-full object-cover rounded-md opacity-80"
            unoptimized
          />
        </div>
      )}
      </div>
      </div>

      {/* Version History */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('person.versionHistory.title')}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t('person.versionHistory.subtitle')} ({person.versions.length} {person.versions.length !== 1 ? t('person.versionHistory.versions') : t('person.versionHistory.version')})
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('person.versionHistory.columns.version')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.changeType')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.source')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.deleted')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.name')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.dateOfDeath')}</TableHead>
                  <TableHead>{t('person.versionHistory.columns.timestamp')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {person.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">
                      v{version.versionNumber}
                    </TableCell>
                    <TableCell>
                      {getChangeTypeBadge(version.changeType)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getSourceBadge(version.source)}
                        <p className="text-xs text-muted-foreground">
                          {version.source.description}
                        </p>
                        {version.source.bulkUpload && (
                          <p className="text-xs text-muted-foreground force-ltr">
                            {version.source.bulkUpload.comment} ({formatDate(version.source.bulkUpload.dateReleased)})
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={version.isDeleted ? 'destructive' : 'outline'}>
                        {version.isDeleted ? t('person.versionHistory.yes') : t('person.versionHistory.no')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {version.name}
                      {version.nameEnglish && (
                        <span className="text-muted-foreground text-sm block">
                          {version.nameEnglish}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="force-ltr">
                      {version.dateOfDeath ? (
                        <span className="text-destructive">
                          {formatDate(version.dateOfDeath)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm force-ltr">
                      {formatDateTime(version.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

