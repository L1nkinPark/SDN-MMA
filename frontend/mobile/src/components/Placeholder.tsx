import { Header } from './Header';
import { Screen } from './Screen';

/** Stand-in for a screen owned by Person A. Shows only the screen name. */
export function Placeholder({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <Screen>
      <Header title={title} back={back} />
    </Screen>
  );
}
