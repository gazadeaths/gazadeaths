import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
        // Align Clerk's internals with our dark palette tokens
        variables: {
          colorBackground: 'hsl(var(--background))',
          colorText: 'hsl(var(--foreground))',
          colorPrimary: 'hsl(var(--primary))',
          colorInputBackground: 'hsl(var(--input))',
          colorInputText: 'hsl(var(--foreground))',
          colorShimmer: 'hsl(var(--muted))',
          colorTextOnPrimaryBackground: 'hsl(var(--primary-foreground))',
          colorBorder: 'hsl(var(--border))',
          borderRadius: 'var(--radius)',
        },
        // Map Clerk parts to shadcn utility classes to restore borders/backgrounds
        elements: {
          rootBox: 'text-foreground',
          card: 'bg-card text-card-foreground border border-border shadow',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
          formButtonPrimary:
            'bg-primary text-primary-foreground hover:bg-primary/90 border border-border',
          socialButtonsBlockButton:
            'bg-muted text-foreground hover:bg-muted/90 border border-border',
          formFieldInput:
            'bg-input text-foreground border border-border placeholder:text-muted-foreground',
          formFieldLabel: 'text-foreground',
          formFieldAction: 'text-muted-foreground',
          footer: 'text-muted-foreground',
          dividerLine: 'bg-border',
          avatarImage: 'rounded-md',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

