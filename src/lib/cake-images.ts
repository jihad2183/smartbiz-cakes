import blackForest from '@/assets/black-forest.jpg';
import redVelvet from '@/assets/red-velvet.jpg';
import mangoCream from '@/assets/mango-cream.jpg';
import chocolateTruffle from '@/assets/chocolate-truffle.jpg';

const images: Record<string, string> = { 'cake:black-forest': blackForest, 'cake:red-velvet': redVelvet, 'cake:mango-cream': mangoCream, 'cake:chocolate-truffle': chocolateTruffle };
export const cakeImage = (url: string | null) => url ? images[url] ?? url : undefined;