FROM --platform=linux/amd64 mcr.microsoft.com/playwright@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7
USER root
LABEL ci-cadence.scope="B-local-qa-public-tools" \
      ci-cadence.playwright="1.63.0" \
      ci-cadence.node="24.21.0" \
      ci-cadence.npm="11.4.0" \
      ci-cadence.lhci-commit="3e7e23fb74242897f95c0ba9cabad3d0227b9b18"
# Context contains only the public payloads below. No app source or credentials.
COPY public/ /tmp/public-inputs/
COPY public.sha256 /tmp/public-inputs/public.sha256
RUN cd /tmp/public-inputs && sha256sum --check public.sha256
RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/nodesource.list /etc/apt/sources.list.d/google-chrome.list \
    && rm -f /etc/apt/sources.list.d/*.sources \
    && printf '%s\n' \
      'Types: deb' \
      'URIs: http://archive.ubuntu.com/ubuntu' \
      'Suites: noble noble-updates' \
      'Components: main universe' \
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' \
      'Snapshot: 20261003T000000Z' \
      '' \
      'Types: deb' \
      'URIs: http://security.ubuntu.com/ubuntu' \
      'Suites: noble-security' \
      'Components: main universe' \
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' \
      'Snapshot: 20261003T000000Z' > /etc/apt/sources.list.d/ubuntu.sources \
    && timeout 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 update \
    && timeout 300 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 install -y \
       build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev \
       python3 pkg-config iptables iproute2 procps util-linux \
       /tmp/public-inputs/google-chrome-stable_154.0.8037.97-1_amd64.deb \
    && rm -f /etc/apt/sources.list.d/google-chrome.list \
    && mkdir -p /opt/runtime-record \
    && dpkg-query -W > /opt/runtime-record/dpkg-versions.txt \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/node-v24.21.0 /opt/node-headers-v24.21.0 /opt/npm-11.4.0 /opt/lhci-action /opt/font-inputs \
    && tar -xJf /tmp/public-inputs/node-v24.21.0-linux-x64.tar.xz --strip-components=1 -C /opt/node-v24.21.0 \
    && tar -xzf /tmp/public-inputs/node-v24.21.0-headers.tar.gz --strip-components=1 -C /opt/node-headers-v24.21.0 \
    && tar -xzf /tmp/public-inputs/npm-11.4.0.tgz --strip-components=1 -C /opt/npm-11.4.0 \
    && ln -sf /opt/npm-11.4.0/bin/npm-cli.js /opt/node-v24.21.0/bin/npm \
    && ln -sf /opt/npm-11.4.0/bin/npx-cli.js /opt/node-v24.21.0/bin/npx \
    && tar -xzf /tmp/public-inputs/lighthouse-ci-action-3e7e23fb74242897f95c0ba9cabad3d0227b9b18.tar.gz \
       --strip-components=1 -C /opt/lhci-action \
       lighthouse-ci-action-3e7e23fb74242897f95c0ba9cabad3d0227b9b18/node_modules \
    && cp /tmp/public-inputs/inter.css /tmp/public-inputs/*.woff2 /opt/font-inputs/ \
    && cp /tmp/public-inputs/public.sha256 /opt/runtime-record/ \
    && chmod -R a-w /ms-playwright /opt/node-v24.21.0 /opt/node-headers-v24.21.0 /opt/npm-11.4.0 /opt/lhci-action /opt/font-inputs \
    && rm -rf /tmp/public-inputs
ENV PATH="/opt/node-v24.21.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    PLAYWRIGHT_BROWSERS_PATH="/ms-playwright" \
    npm_config_nodedir="/opt/node-headers-v24.21.0" \
    NEXT_TELEMETRY_DISABLED="1"
USER pwuser
WORKDIR /home/pwuser
CMD ["/bin/bash"]
