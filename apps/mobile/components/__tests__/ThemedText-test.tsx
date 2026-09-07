jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: { colors: { primary: '#17406A' } } })
}));

import * as React from 'react';
import renderer from 'react-test-renderer';

import { ThemedText } from '../ThemedText';

it(`renders correctly`, async () => {
  let component!: ReturnType<typeof renderer.create>;

  await renderer.act(() => {
    component = renderer.create(<ThemedText>Snapshot test!</ThemedText>);
  });

  expect(component.toJSON()).toMatchSnapshot();

  await renderer.act(() => {
    component.unmount();
  });
});

it('uses the selected conference color for links', async () => {
  let component!: ReturnType<typeof renderer.create>;
  await renderer.act(() => { component = renderer.create(<ThemedText type="link">Conference link</ThemedText>); });
  const tree = component.toJSON() as renderer.ReactTestRendererJSON;
  expect(JSON.stringify(tree.props.style)).toContain('#17406A');
  await renderer.act(() => { component.unmount(); });
});
