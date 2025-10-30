'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { List, Grid, Download } from 'lucide-react';
import { useTranslation, useFormatDate, useFormatNumber } from '@/lib/i18n-context';
import { PersonSearch } from '@/components/PersonSearch';

interface Person {
  id: string;
  externalId: string;
  name: string;
  gender: string;
  dateOfBirth: string;
  dateOfDeath?: string;
  locationOfDeathLat?: number | null;
  locationOfDeathLng?: number | null;
  photoUrlThumb?: string | null;
  isDeleted: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface PersonsData {
  persons: Person[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function PersonsTable() {
  const { t, locale } = useTranslation();
  const { formatDate } = useFormatDate();
  const { formatNumber } = useFormatNumber();
  const [data, setData] = useState<PersonsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'photos'>('photos');
  const [downloading, setDownloading] = useState(false);

  const fetchPersons = useCallback(async (page: number = 1, mode: 'list' | 'photos' = 'list') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: mode === 'photos' ? '24' : '20', // More items for grid view
      });
      
      // TODO: Remove this comment once real photos are in DB
      // Previously filtered to only records with photos, but now we show all records
      // since we have mock photos for development
      
      const response = await fetch(`/api/public/persons?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch persons');
      }

      setData(result.data);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  // Fetch on mount and when viewMode changes
  useEffect(() => {
    fetchPersons(1, viewMode);
  }, [fetchPersons, viewMode]);


  const handleDownloadCSV = async () => {
    try {
      setDownloading(true);
      
      // Build the same query params as the current view
      const params = new URLSearchParams();
      
      if (viewMode === 'photos') {
        params.append('filter', 'with_photo');
      }
      
      const response = await fetch(`/api/public/persons/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }
      
      // Get the CSV blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gaza-deaths-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  if (initialLoad && loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8 text-muted-foreground">
          {t('database.noResults')}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="relative flex items-center h-16 px-4 sm:px-6 lg:px-8 border-t border-b gap-4">
        {/* Left: Total Records Count */}
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          <span className="font-medium text-foreground">{formatNumber(data.pagination.total)}</span> {t('database.pagination.records')}
        </div>
        
        {/* Centered Search - Desktop only */}
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          <PersonSearch variant="header" />
        </div>
        
        {/* Right: Photos/List Toggle */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'photos' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('photos')}
              className="gap-2"
            >
              <Grid className="h-4 w-4" />
              {t('database.viewMode.photos')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              {t('database.viewMode.list')}
            </Button>
          </div>
        </div>
      </div>

      {/* Age Filter Slider - Commented out for now */}
      {/* <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-4 border-b">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">
          Max Age: {sliderValue}
        </label>
        <Slider
          value={[sliderValue]}
          onValueChange={(value) => setSliderValue(value[0])} // Update visual during drag
          onValueCommit={(value) => setMaxAge(value[0])} // Apply filter when released
          min={0}
          max={100}
          step={1}
          className="flex-1 max-w-md"
        />
      </div> */}

      {/* Mobile Search */}
      <div className="md:hidden px-4 sm:px-6 lg:px-8 py-4 border-b">
        <PersonSearch variant="default" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'list' ? (
          /* List View - Table */
          <div className="rounded-md border">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('database.columns.externalId')}</TableHead>
                <TableHead>{t('database.columns.name')}</TableHead>
                <TableHead>{t('database.columns.gender')}</TableHead>
                <TableHead>{t('database.columns.dateOfBirth')}</TableHead>
                <TableHead>{t('database.columns.dateOfDeath')}</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>{t('database.columns.photo')}</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>{t('database.columns.deleted')}</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <Spinner className="mx-auto" />
                  </TableCell>
                </TableRow>
              ) : data.persons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    {t('database.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                data.persons.map((person) => (
                <TableRow key={person.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium py-6 force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.externalId}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.name}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge 
                        variant={
                          person.gender === 'MALE' ? 'default' :
                          person.gender === 'FEMALE' ? 'secondary' :
                          'outline'
                        }
                      >
                        {t(`person.gender.${person.gender}`)}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="py-6 force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {formatDate(person.dateOfBirth)}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6 force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.dateOfDeath ? (
                        <span className="text-destructive">{formatDate(person.dateOfDeath)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6 force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.locationOfDeathLat && person.locationOfDeathLng ? (
                        <span className="text-sm">
                          {person.locationOfDeathLat.toFixed(4)}, {person.locationOfDeathLng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.photoUrlThumb ? (
                        <Image 
                          src={person.photoUrlThumb} 
                          alt={`Photo of ${person.name}`}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-cover rounded border-2 hover:border-primary transition-colors cursor-pointer grayscale"
                          unoptimized
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="py-6">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge variant="secondary">
                        v{person.currentVersion}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="py-6">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge variant={person.isDeleted ? 'destructive' : 'default'}>
                        {person.isDeleted ? t('person.versionHistory.yes') : t('person.versionHistory.no')}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground py-6 force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {formatDate(person.updatedAt)}
                    </Link>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        ) : (
          /* Photo View - Grid */
          <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : data.persons.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {t('database.noResults')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {data.persons.map((person) => (
                  <Link 
                    key={person.id} 
                    href={`/${locale}/person/${person.externalId}`}
                    className="group relative aspect-square overflow-hidden rounded-lg border-2 border-transparent hover:border-primary transition-all"
                  >
                    <Image
                      src={person.photoUrlThumb || '/placeholder.jpg'}
                      alt={person.name}
                      fill
                      className="object-cover grayscale group-hover:grayscale-0 transition-all"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-foreground font-semibold text-sm truncate">{person.name}</p>
                        <p className="text-foreground/80 text-xs">{person.externalId}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination and Download */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-4">
            {data.pagination.pages > 1 && (
              <div className="text-sm text-muted-foreground force-ltr">
                {t('database.pagination.page')} {data.pagination.page} {t('database.pagination.of')} {data.pagination.pages}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={downloading || loading || data.persons.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? t('common.loading') : 'Download CSV'}
            </Button>
            
            {data.pagination.pages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPersons(currentPage - 1, viewMode)}
                  disabled={currentPage === 1}
                >
                  {t('database.pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPersons(currentPage + 1, viewMode)}
                  disabled={currentPage === data.pagination.pages}
                >
                  {t('database.pagination.next')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
