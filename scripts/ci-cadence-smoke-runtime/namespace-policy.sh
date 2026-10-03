#!/bin/bash
# Root-owned private tool; called only after exact target-netns ownership readback.
# Controller supplies only inspected owned addresses and literal service ports.
set -euo pipefail
[[ $# -ge 3 ]]
expected_netns=$1
management_port=$2
shift 2
[[ "$management_port" == 0 || "$management_port" == 5432 || "$management_port" == 8000 || "$management_port" == 8025 ]]
[[ "$(readlink /proc/self/ns/net)" == "$expected_netns" ]]
# Dedicated fresh subnet. Gateway is not an outbound new-connection target.
# The db/Kong management INPUT exception supports root's inspected127.0.0.1
# published API/SQL connection only, and OUTPUT permits established replies.
for pair in "$@"; do
  [[ "$pair" =~ ^172\.30\.214\.([0-9]{1,3}):(5432|8000|9999|3000|4000|5000|5001|1025|8025)$ ]]
  host=${BASH_REMATCH[1]}
  [[ "$host" -ge 2 && "$host" -le 254 ]]
done
iptables -w 5 -P OUTPUT DROP
iptables -w 5 -P INPUT DROP
iptables -w 5 -P FORWARD DROP
iptables -w 5 -F OUTPUT
iptables -w 5 -F INPUT
iptables -w 5 -F FORWARD
iptables -w 5 -A OUTPUT -d 127.0.0.11 -j DROP
iptables -w 5 -A OUTPUT -p udp --dport 53 -j DROP
iptables -w 5 -A OUTPUT -p tcp --dport 53 -j DROP
iptables -w 5 -A OUTPUT -o lo -j ACCEPT
iptables -w 5 -A INPUT -i lo -j ACCEPT
# Established bootstrap connections are not blindly grandfathered.
for pair in "$@"; do
  address=${pair%:*}; port=${pair##*:}
  iptables -w 5 -A OUTPUT -d "$address" -p tcp --dport "$port" -j ACCEPT
  iptables -w 5 -A INPUT -s "$address" -p tcp -m conntrack --ctstate ESTABLISHED -j ACCEPT
  iptables -w 5 -A INPUT -s "$address" -p tcp --dport 5432 -j ACCEPT
  iptables -w 5 -A INPUT -s "$address" -p tcp -m multiport --dports 8000,9999,3000,4000,5000,5001,1025,8025 -j ACCEPT
  iptables -w 5 -A OUTPUT -d "$address" -p tcp -m conntrack --ctstate ESTABLISHED -j ACCEPT
done
if [[ "$management_port" != 0 ]]; then
  iptables -w 5 -A INPUT -s 172.30.214.1 -p tcp --dport "$management_port" -j ACCEPT
  iptables -w 5 -A OUTPUT -d 172.30.214.1 -p tcp --sport "$management_port" -m conntrack --ctstate ESTABLISHED -j ACCEPT
fi
ip6tables -w 5 -P OUTPUT DROP
ip6tables -w 5 -P INPUT DROP
ip6tables -w 5 -P FORWARD DROP
ip6tables -w 5 -F OUTPUT
ip6tables -w 5 -F INPUT
ip6tables -w 5 -F FORWARD
ip6tables -w 5 -A OUTPUT -p udp --dport 53 -j DROP
ip6tables -w 5 -A OUTPUT -p tcp --dport 53 -j DROP
ip6tables -w 5 -A OUTPUT -o lo -j ACCEPT
ip6tables -w 5 -A INPUT -i lo -j ACCEPT
iptables-save
ip6tables-save
