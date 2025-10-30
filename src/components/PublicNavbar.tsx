'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SignInButton, SignOutButton, useAuth, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Menu, Globe, User, LogOut, Settings, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n-context';
import { removeLocaleFromPathname, addLocaleToPathname, type Locale } from '@/lib/i18n';
import Image from 'next/image';

export function PublicNavbar() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const isStaff = user?.publicMetadata?.role === 'admin' || user?.publicMetadata?.role === 'moderator';
  const isPersonPage = pathname?.startsWith(`/${locale}/person/`);
  const isAdminSection = pathname?.startsWith('/tools');

  // Get path without locale for comparison
  const pathWithoutLocale = removeLocaleFromPathname(pathname || '');

  // Function to switch language
  const switchLanguage = (newLocale: Locale) => {
    const pathWithoutCurrentLocale = removeLocaleFromPathname(pathname || '');
    const newPath = addLocaleToPathname(pathWithoutCurrentLocale, newLocale);
    
    // Set cookie for persistence
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1 year
    
    // Navigate to new path
    router.push(newPath);
  };

  // Don't show language toggle in admin section
  const showLanguageToggle = !isAdminSection;

  return (
    <nav className={`sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${isPersonPage ? 'border-b' : ''}`}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Left: Navigation Links */}
          <div className="flex items-center space-x-6 rtl:space-x-reverse">
            {/* Mobile Menu Button - Always visible */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side={locale === 'ar' ? 'right' : 'left'} className="w-64">
                <SheetHeader>
                  <SheetTitle>{t('nav.about')}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-4 mt-6">
                  <Link
                    href={`/${locale}/about`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 text-base font-medium transition-colors ${
                      pathWithoutLocale === '/about'
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('nav.about')}
                  </Link>
                  <Link
                    href={`/${locale}/database`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 text-base font-medium transition-colors ${
                      pathWithoutLocale === '/database' || pathWithoutLocale.startsWith('/person/')
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('nav.database')}
                  </Link>
                  <Link
                    href={`/${locale}/sources`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 text-base font-medium transition-colors ${
                      pathWithoutLocale === '/sources'
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('nav.sources')}
                  </Link>
                  
                  {/* User Menu - Only when signed in (Mobile) */}
                  {isSignedIn && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <p className="px-3 py-2 text-xs text-muted-foreground uppercase">{t('nav.signedInAs') || 'Signed in as'}</p>
                        <p className="px-3 pb-2 text-sm font-medium">{user?.emailAddresses[0]?.emailAddress}</p>
                      </div>
                      
                      <Link
                        href={`/${locale}/contribution`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {t('nav.contributions')}
                      </Link>
                      
                      {isStaff && (
                        <Link
                          href="/tools"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          {t('nav.adminTools')}
                        </Link>
                      )}
                    </>
                  )}

                  {/* Language Toggle - Mobile */}
                  {showLanguageToggle && (
                    <button
                      onClick={() => {
                        switchLanguage(locale === 'ar' ? 'en' : 'ar');
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors border-t pt-4 mt-4 text-left rtl:text-right"
                    >
                      <Globe className="h-4 w-4" />
                      {locale === 'ar' ? 'English' : 'العربية'}
                    </button>
                  )}

                  {/* User Button / Sign In - Mobile only */}
                  <div className="border-t pt-4 mt-4">
                    {isSignedIn ? (
                      <SignOutButton>
                        <button className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left rtl:text-right">
                          {t('nav.signOut')}
                        </button>
                      </SignOutButton>
                    ) : (
                      <SignInButton mode="modal">
                        <button className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left rtl:text-right">
                          {t('nav.signIn')}
                        </button>
                      </SignInButton>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>

            {/* Desktop Navigation - Always visible */}
            <div className="hidden md:flex items-center space-x-8 rtl:space-x-reverse">
              <Link
                href={`/${locale}/about`}
                className={`px-3 py-2 text-base font-medium transition-colors border-b-2 ${
                  pathWithoutLocale === '/about'
                    ? 'text-foreground font-semibold border-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:border-accent-foreground/50'
                }`}
              >
                {t('nav.about')}
              </Link>
              <Link
                href={`/${locale}/database`}
                className={`px-3 py-2 text-base font-medium transition-colors border-b-2 ${
                  pathWithoutLocale === '/database' || pathWithoutLocale.startsWith('/person/')
                    ? 'text-foreground font-semibold border-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:border-accent-foreground/50'
                }`}
              >
                {t('nav.database')}
              </Link>
              <Link
                href={`/${locale}/sources`}
                className={`px-3 py-2 text-base font-medium transition-colors border-b-2 ${
                  pathWithoutLocale === '/sources'
                    ? 'text-foreground font-semibold border-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:border-accent-foreground/50'
                }`}
              >
                {t('nav.sources')}
              </Link>
            </div>
          </div>

          {/* Center: Logo/Title */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Link href={`/${locale}/`} className="flex items-center gap-4">
              {locale === 'ar' ? (
                <>
                  <span className="text-2xl text-foreground/80 whitespace-nowrap">شهداء غزة</span>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">Gaza Witnesses</span>
                </>
              ) : (
                <>
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">Gaza Witnesses</span>
                  <span className="text-2xl text-foreground/80 whitespace-nowrap">شهداء غزة</span>
                </>
              )}
            </Link>
          </div>

          {/* Right Side: Language + User Menu (Desktop only) */}
          <div className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
            
            {/* Language Selector */}
            {showLanguageToggle && (
              <button 
                onClick={() => switchLanguage(locale === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              >
                <Globe className="h-4 w-4" />
                <span className={locale === 'ar' ? 'text-md' : 'text-lg'}>
                  {locale === 'ar' ? 'English' : 'العربية'}
                </span>
              </button>
            )}

            {/* User Menu - Desktop only */}
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={locale === 'ar' ? 'start' : 'end'} className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">{t('nav.signedInAs') || 'Signed in as'}</p>
                    <p className="text-sm font-medium truncate">{user?.emailAddresses[0]?.emailAddress}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/contribution`} className="cursor-pointer flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t('nav.contributions')}
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link href="/tools" className="cursor-pointer flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {t('nav.adminTools')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SignOutButton>
                      <button className="w-full cursor-pointer flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        {t('nav.signOut')}
                      </button>
                    </SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SignInButton mode="modal">
                <button className="text-muted-foreground hover:text-foreground px-3 py-2 text-md font-medium transition-colors cursor-pointer">
                  {t('nav.signIn')}
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

