export interface Campaign {
  id: string;
  title: string;
  description: string;
  raised: number;
  goal: number;
  deadline: string;
  image: string;
  creator?: string;
  contractId?: string;
}
