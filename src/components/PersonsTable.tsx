'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Download, ArrowUp, ArrowDown } from 'lucide-react';
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

type SortField = 'updatedAt' | 'name' | 'dateOfBirth';
type SortOrder = 'asc' | 'desc';

export function PersonsTable() {
  const { t, locale } = useTranslation();
  const { formatDate } = useFormatDate();
  const { formatNumber } = useFormatNumber();
  const [data, setData] = useState<PersonsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [downloading, setDownloading] = useState(false);

  const fetchPersons = useCallback(async (page: number = 1, sort: SortField = sortBy, order: SortOrder = sortOrder) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: sort,
        sortOrder: order,
      });

      const response = await fetch(`/api/public/persons?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch persons');
      }

      setData(result.data);
      setCurrentPage(page);
      setPageInput(page.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    fetchPersons(1, sortBy, sortOrder);
  }, [fetchPersons, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (data && page >= 1 && page <= data.pagination.pages) {
      fetchPersons(page);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc'
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const sortableHeadClass = "cursor-pointer hover:text-foreground select-none";

  const handleDownloadCSV = async () => {
    try {
      setDownloading(true);

      const response = await fetch(`/api/public/persons/export`);

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      const blob = await response.blob();

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

        <div className="ml-auto" />
      </div>

      {/* Mobile Search */}
      <div className="md:hidden px-4 sm:px-6 lg:px-8 py-4 border-b">
        <PersonSearch variant="default" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-md border">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('database.columns.externalId')}</TableHead>
                <TableHead
                  className={sortableHeadClass}
                  onClick={() => handleSort('name')}
                >
                  {t('database.columns.name')}<SortIcon field="name" />
                </TableHead>
                <TableHead>{t('database.columns.gender')}</TableHead>
                <TableHead
                  className={sortableHeadClass}
                  onClick={() => handleSort('dateOfBirth')}
                >
                  {t('database.columns.dateOfBirth')}<SortIcon field="dateOfBirth" />
                </TableHead>
                <TableHead className="hidden sm:table-cell">{t('database.columns.dateOfDeath')}</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden md:table-cell">{t('database.columns.photo')}</TableHead>
                <TableHead className="hidden lg:table-cell">Version</TableHead>
                <TableHead className="hidden md:table-cell">{t('database.columns.deleted')}</TableHead>
                <TableHead
                  className={`hidden sm:table-cell ${sortableHeadClass}`}
                  onClick={() => handleSort('updatedAt')}
                >
                  Last Updated<SortIcon field="updatedAt" />
                </TableHead>
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
                  <TableCell className="font-medium py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.externalId}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.name}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge variant="outline">
                        {t(`person.gender.${person.gender}`)}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {formatDate(person.dateOfBirth)}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.dateOfDeath ? (
                        <span>{formatDate(person.dateOfDeath)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm force-ltr">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.locationOfDeathLat && person.locationOfDeathLng ? (
                        <span>
                          {person.locationOfDeathLat.toFixed(4)}, {person.locationOfDeathLng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      {person.photoUrlThumb ? (
                        <Image
                          src={person.photoUrlThumb}
                          alt={`Photo of ${person.name}`}
                          width={36}
                          height={36}
                          className="w-8 h-8 min-[1440px]:w-12 min-[1440px]:h-12 object-cover rounded border hover:border-foreground transition-colors cursor-pointer grayscale"
                          unoptimized
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge variant="outline">
                        v{person.currentVersion}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm">
                    <Link href={`/${locale}/person/${person.externalId}`} className="block">
                      <Badge variant="outline">
                        {person.isDeleted ? t('person.versionHistory.yes') : t('person.versionHistory.no')}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground py-3 min-[1440px]:py-6 text-xs min-[1440px]:text-sm force-ltr">
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

        {/* Pagination and Download */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-4">
            {data.pagination.pages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground force-ltr">
                <span>{t('database.pagination.page')}</span>
                <form onSubmit={handlePageInputSubmit} className="inline">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageInputSubmit}
                    className="w-12 text-center bg-transparent border rounded px-1 py-0.5 text-foreground text-sm"
                  />
                </form>
                <span>{t('database.pagination.of')} {formatNumber(data.pagination.pages)}</span>
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
              <span className="hidden sm:inline">{downloading ? t('common.loading') : 'Download CSV'}</span>
              <span className="sm:hidden">{downloading ? '...' : 'CSV'}</span>
            </Button>

            {data.pagination.pages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPersons(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  {t('database.pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPersons(currentPage + 1)}
                  disabled={currentPage === data.pagination.pages || loading}
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
