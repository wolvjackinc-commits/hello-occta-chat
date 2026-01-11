import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/layout/Layout";

const CheckoutSkeleton = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Back Link */}
          <Skeleton className="h-5 w-32 mb-8" />

          {/* Title */}
          <Skeleton className="h-12 w-80 mb-8" />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form - Left Side */}
            <div className="lg:col-span-2 space-y-8">
              {/* Customer Information */}
              <div className="border-4 border-foreground/20 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-8 w-40" />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Switching Information */}
              <div className="border-4 border-foreground/20 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-8 w-48" />
                </div>
                
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary - Right Side */}
            <div className="lg:col-span-1">
              <div className="border-4 border-foreground/20 bg-card p-6 sticky top-24">
                <Skeleton className="h-8 w-40 mb-6" />
                
                {/* Plan Card */}
                <div className="p-4 border-2 border-foreground/20 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-10 w-10" />
                    <div className="flex-grow">
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-5 w-20" />
                    ))}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 py-4 border-t-2 border-foreground/10">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="py-4 border-t-4 border-foreground/20">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>

                {/* Submit Button */}
                <Skeleton className="h-14 w-full mt-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutSkeleton;
