import createMDX from '@next/mdx';

const config = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  devIndicators: false,
  agentRules: false,
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    return webpackConfig;
  },
};

export default createMDX()(config);
