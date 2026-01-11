import { Skeleton } from "@/components/ui/skeleton";

const ServicePageSkeleton = () => {
  return (
    <div className="animate-fade-in">
      {/* Hero Section Skeleton */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Badge */}
            <Skeleton className="h-8 w-48 mb-6 border-4 border-foreground/20" />
            
            {/* Heading */}
            <Skeleton className="h-16 w-full max-w-lg mb-4" />
            <Skeleton className="h-16 w-3/4 mb-6" />
            
            {/* Description */}
            <Skeleton className="h-6 w-full max-w-xl mb-2" />
            <Skeleton className="h-6 w-4/5 mb-8" />
            
            {/* Features */}
            <div className="flex flex-wrap gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-32" />
              ))}
            </div>
            
            {/* CTA Button */}
            <Skeleton className="h-14 w-48" />
          </div>
        </div>
      </section>

      {/* Plans Section Skeleton */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          {/* Section Header */}
          <div className="text-center mb-16">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          
          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-4 border-foreground/20 bg-card p-6 space-y-4">
                {/* Plan Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-10 w-10" />
                </div>
                
                {/* Price */}
                <div className="py-4 border-y-2 border-foreground/10">
                  <Skeleton className="h-10 w-28 mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
                
                {/* Features */}
                <div className="space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
                
                {/* Button */}
                <Skeleton className="h-12 w-full mt-4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicePageSkeleton;
