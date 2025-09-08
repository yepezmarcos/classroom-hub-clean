
import './globals.css';
import { Providers } from './providers';
import Link from 'next/link';

export const metadata = { title: 'Classroom Hub', description: 'K-12 Teacher Platform' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body>
<Providers>
<div className="shell">
<aside className="sidebar">
<h1 className="logo"><Link href="/">Classroom Hub</Link></h1>
<nav>
<Link href="/dashboard">Dashboard</Link>
<Link href="/students">Students</Link>
<Link href="/classes">Classes</Link>
<Link href="/comments">Comment Bank</Link>
<Link href="/gradebook">Gradebook</Link>
<Link href="/contacts">Contacts</Link>
<Link href="/settings">Settings</Link>
</nav>
<a className="muted" href="/api/auth/signout">Sign out</a>
</aside>
<main className="content">{children}</main>
</div>
</Providers>
</body>
</html>
);
}
