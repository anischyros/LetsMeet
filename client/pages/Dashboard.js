/* vendor dependencies */
import React, { Component } from 'react';
import { browserHistory, Link } from 'react-router';
import fetch from 'isomorphic-fetch';
import cssModules from 'react-css-modules';
import Masonry from 'react-masonry-component';
import autobind from 'autobind-decorator';
import nprogress from 'nprogress';
import { NotificationStack } from 'react-notification';
import { OrderedSet } from 'immutable';
import jsonpatch from 'fast-json-patch';

/* external components */
import EventCard from '../components/EventCard';

/* styles */
import styles from '../styles/dashboard.css';

/* utilities */
import { checkStatus, parseJSON } from '../util/fetch.util';
import { isAuthenticated } from '../util/auth';

class Dashboard extends Component {
  constructor() {
    super();
    this.state = {
      events: [],
      notifications: OrderedSet(),
      count: 0,
    };
  }

  async componentWillMount() {
    if (sessionStorage.getItem('redirectTo')) {
      browserHistory.push(sessionStorage.getItem('redirectTo'));
      sessionStorage.removeItem('redirectTo');
    }

    if (!await isAuthenticated()) browserHistory.push('/');

    nprogress.configure({ showSpinner: false });
    nprogress.start();
    const response = await fetch('/api/events/getByUser', { credentials: 'same-origin' });
    let events;
    try {
      checkStatus(response);
      events = await parseJSON(response);
    } catch (err) {
      console.log(err);
      this.addNotification('Error!!', 'Failed to load events. Please try again later.');
      return;
    } finally {
      nprogress.done();
      this.setState({ showNoScheduledMessage: true });
    }

    this.setState({ events });
    this.loadEventsNotifications();
  }

  removeNotification(key) {
    const { notifications, count} = this.state;
    console.log('removeNotification', key);
    this.setOwnerNotified(key);
    this.setState({
      notifications: notifications.filter(n => n.key !== key),
    });
  }

  addNotification(msgTitle, msg, participantId = 0) {
    const { notifications, count } = this.state;
    const newCount = count + 1;
    let msgKey = count + 1;
    if (participantId !== 0) {
      msgKey = participantId;
    }
    return this.setState({
      count: newCount,
      notifications: notifications.add({
        message: msg,
        title: msgTitle,
        key: msgKey,
        action: 'Dismiss',
        dismissAfter: 3400,
        onClick: () => this.removeNotification(msgKey),
      }),
    });
  }

  async setOwnerNotified(participantId) {
    const { events } = this.state;
    events.forEach((event) => {
      event.participants.forEach((participant, index) => {
        if (participant._id === participantId) {
          const observerEvent = jsonpatch.observe(event);
          event.participants[index].ownerNotified = true;
          const patches = jsonpatch.generate(observerEvent);
          fetch(`/api/events/${event._id}`, {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            method: 'PATCH',
            body: JSON.stringify(patches),
          });
        }
      });
    });
  }

  @autobind
  removeEventFromDashboard(eventId) {
    this.setState({
      events: this.state.events.filter(event => event._id !== eventId),
    });
  }

  @autobind
  loadEventsNotifications() {
    this.state.events.forEach((event) => {
      event.participants.forEach(
        (participant) => {
          if (participant.ownerNotified === false && participant.userId !== event.owner) {
            this.addNotification('Info', `${participant.name} accept your invite for ${event.name}.`, participant._id);
          }
        });
    });
  }

  render() {
    return (
      <div styleName="wrapper">
        {/* New Event Icon */}
        <div className="fixed-action-btn" styleName="new-event-icon">
          <Link to="/event/new" className="btn-floating btn-large red">
            <i className="large material-icons">add</i>
          </Link>
        </div>
        {/* Card Template */}
        {this.state.events.length !== 0 ?
          <Masonry>
            {this.state.events.map(event => (
              <EventCard
                key={event._id}
                event={event}
                removeEventFromDashboard={this.removeEventFromDashboard}
              />
            ))}
          </Masonry> :
            this.state.showNoScheduledMessage ?
              <em>
                <h4 styleName="no-select" className="card-title center-align black-text">
                  You have no scheduled events yet.
                </h4>
              </em> :
              null
        }
        <NotificationStack
          notifications={this.state.notifications.toArray()}
          onDismiss={notification => this.setState({
            notifications: this.state.notifications.delete(notification),
          })}
        />
      </div>
    );
  }
}

export default cssModules(Dashboard, styles);

