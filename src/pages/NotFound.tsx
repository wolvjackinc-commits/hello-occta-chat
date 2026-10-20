import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/seo";

const links = [
  { label: "Broadband", href: "/broadband" },
  { label: "SIM plans", href: "/sim" },
  { label: "Help centre", href: "/help" },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    const tags = [...document.querySelectorAll('meta[name="robots"]')];
    tags.forEach((node, index) => {
      if (index === 0) node.setAttribute("content", "noindex, nofollow");
      else node.remove();
    });
  }, [location.pathname]);

  return (
    <div className="dark hero-stage relative flex min-h-screen items-center overflow-clip bg-background text-foreground">
      <SEO
        title="This page could not be found"
        description="This OCCTA page does not exist. Head back to broadband, SIM and help, or check the address in the availability checker."
        noIndex
      />
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 md:px-12">
        <a href="/" className="inline-flex items-center gap-2" aria-label="OCCTA home">
          <span className="flex h-10 w-10 items-center justify-center border-[3px] border-white bg-primary font-display text-xl text-black">O</span>
          <span className="font-display text-2xl leading-none text-white">OCCTA</span>
        </a>

        <h1 className="mt-10 font-display text-[9rem] leading-[0.8] text-primary sm:text-[14rem] lg:text-[18rem]">404</h1>
        <p className="mt-6 font-display text-4xl uppercase leading-none text-white sm:text-5xl">Oops! Page not found</p>
        <p className="mt-4 max-w-xl text-lg text-white/65">
          The address <span className="break-all font-mono text-white/85">{location.pathname}</span> doesn't match a page on our site.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/"
            className="inline-flex h-14 items-center gap-2 border-[3px] border-primary bg-primary px-7 font-display text-lg uppercase text-black transition-colors hover:bg-white hover:border-white"
          >
            Return to Home
            <ArrowRight className="h-5 w-5" />
          </a>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex h-14 items-center border-[3px] border-white/30 px-6 font-display text-lg uppercase text-white transition-colors hover:border-primary hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
