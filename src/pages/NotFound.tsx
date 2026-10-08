import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SEO } from "@/components/seo";

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
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <SEO
        title="This page could not be found"
        description="This OCCTA page does not exist. Head back to broadband, SIM and help, or check the address in the availability checker."
        noIndex
      />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
