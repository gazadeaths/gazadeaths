import { prisma } from '@/lib/prisma';
import enTranslations from '@/locales/en.json';
import arTranslations from '@/locales/ar.json';

interface BulkUpload {
  id: string;
  filename: string;
  comment: string | null;
  dateReleased: Date;
  uploadedAt: Date;
  fileUrl: string;
  fileSize: number;
  stats: {
    total: number;
    inserts: number;
    updates: number;
    deletes: number;
  };
}

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
} as const;

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const translations = translationsMap[locale as keyof typeof translationsMap] || translationsMap.en;
  
  // Translation helper function
  const t = (key: string): string => {
    const keys = key.split('.');
    let result: unknown = translations;
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }
    return typeof result === 'string' ? result : key;
  };

  // Fetch all bulk uploads with their change sources
  const bulkUploads = await prisma.bulkUpload.findMany({
    include: {
      changeSource: {
        include: {
          versions: {
            select: {
              changeType: true,
            },
          },
        },
      },
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  // Calculate stats for each upload
  const uploads: BulkUpload[] = bulkUploads.map((upload) => {
    const versions = upload.changeSource.versions;
    const inserts = versions.filter(v => v.changeType === 'INSERT').length;
    const updates = versions.filter(v => v.changeType === 'UPDATE').length;
    const deletes = versions.filter(v => v.changeType === 'DELETE').length;

    return {
      id: upload.id,
      filename: upload.filename,
      comment: upload.comment,
      dateReleased: upload.dateReleased,
      uploadedAt: upload.uploadedAt,
      fileUrl: upload.fileUrl,
      fileSize: upload.fileSize,
      stats: {
        total: versions.length,
        inserts,
        updates,
        deletes,
      },
    };
  });

  const formatDate = (date: Date) => date.toLocaleDateString(locale, { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">{t('sources.title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            {t('sources.description')}
          </p>
        </div>

        {uploads.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border">
            <p className="text-muted-foreground">{t('sources.noSources')}</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.dateReleased')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.filename')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.comment')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.totalChanges')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.inserts')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.updates')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.deletes')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('sources.table.download')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {formatDate(upload.dateReleased)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {upload.filename}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                        {upload.comment || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {upload.stats.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                        +{upload.stats.inserts.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                        {upload.stats.updates.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-destructive">
                        −{upload.stats.deletes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={upload.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {t('sources.table.downloadLink')} ({formatFileSize(upload.fileSize)})
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-muted-foreground">
          <p>{t('sources.footer')}</p>
        </div>
      </div>
    </div>
  );
}

