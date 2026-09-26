import { Shapeshift } from "@/components/shapeshift/Shapeshift";
import { SiteChrome } from "@/components/shapeshift/SiteChrome";
import { ExplainToggle } from "@/components/shapeshift/ExplainToggle";

export default function Home() {
  return (
    <>
      <Shapeshift />
      <SiteChrome>
        <ExplainToggle />
      </SiteChrome>
    </>
  );
}
