FROM catthehacker/ubuntu:act-22.04
RUN NODE_DIR=$(ls -d /opt/acttoolcache/node/*/x64/bin | head -1) && \
    ln -sf "$NODE_DIR/node" /usr/local/bin/node && \
    ln -sf "$NODE_DIR/npm" /usr/local/bin/npm && \
    ln -sf "$NODE_DIR/npx" /usr/local/bin/npx
RUN (type -p wget >/dev/null || (apt-get update && apt-get install -y wget)) && \
    mkdir -p /etc/apt/keyrings && \
    wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip && \
    unzip -q /tmp/awscliv2.zip -d /tmp && \
    /tmp/aws/install && \
    rm -rf /tmp/aws /tmp/awscliv2.zip
